"""Durable market ingestion work executed by the background worker."""

import hashlib
import logging
from datetime import UTC, datetime, timedelta

from sqlalchemy import delete, select
from sqlalchemy.orm import Session

from .collectors import collect, is_new_zealand_location
from .database import SessionLocal
from .models import CollectorRun, CollectorSource, JobPosting, JobPostingSkill, MarketSource
from .rag import index_job_postings
from .role_decoder import decode_role
from .schemas import JobPostingInput, MarketSourceInput

logger = logging.getLogger(__name__)
MAX_ATTEMPTS = 3
RUN_LEASE = timedelta(minutes=10)


def persist_market_postings(
    db: Session,
    source_input: MarketSourceInput,
    postings: list[JobPostingInput],
) -> dict[str, int]:
    base_url = str(source_input.base_url)
    source = db.scalar(
        select(MarketSource).where(
            MarketSource.name == source_input.name,
            MarketSource.source_type == source_input.source_type,
            MarketSource.base_url == base_url,
        )
    )
    if source is None:
        source = MarketSource(
            name=source_input.name,
            source_type=source_input.source_type,
            permission_basis=source_input.permission_basis,
            base_url=base_url,
        )
        db.add(source)
        db.flush()
    else:
        source.permission_basis = source_input.permission_basis
    imported = 0
    updated = 0
    for item in postings:
        source_url = str(item.source_url)
        content_hash = hashlib.sha256(f"{item.title}\n{item.description}".encode()).hexdigest()
        posting = db.scalar(select(JobPosting).where(JobPosting.source_url == source_url))
        decoded = decode_role(item.title, item.description)
        if posting is None:
            posting = JobPosting(source_id=source.id, source_url=source_url)
            db.add(posting)
            imported += 1
        else:
            posting.source_id = source.id
            db.execute(delete(JobPostingSkill).where(JobPostingSkill.posting_id == posting.id))
            updated += 1
        posting.content_hash = content_hash
        posting.title = item.title
        posting.company = item.company
        posting.location = item.location
        posting.description = item.description
        posting.role_family = decoded.role_family
        posting.seniority = decoded.seniority
        posting.classification_confidence = decoded.confidence
        posting.published_at = item.published_at
        db.flush()
        db.add_all(
            JobPostingSkill(posting_id=posting.id, skill_slug=slug, mention_count=count)
            for slug, _, count in decoded.matched_skills
        )
    return {"imported": imported, "updated": updated}


def execute_collector_run(run_id) -> None:
    with SessionLocal() as db:
        run = db.get(CollectorRun, run_id)
        if run is None:
            return
        source = db.get(CollectorSource, run.collector_source_id)
        if source is None or not source.enabled:
            run.status = "failed"
            run.error_message = "Collector source is unavailable or disabled"
            run.completed_at = datetime.now(UTC)
            db.commit()
            return
        try:
            collected = collect(source.adapter, source.identifier, source.company)
            accepted = [item for item in collected if is_new_zealand_location(item.location)]
            valid: list[JobPostingInput] = []
            for item in accepted:
                try:
                    valid.append(JobPostingInput.model_validate(item.__dict__))
                except ValueError:
                    continue
            relevant = [
                item
                for item in valid
                if decode_role(item.title, item.description).scope_status != "out_of_scope"
            ]
            structured_adapters = {"greenhouse", "lever", "ashby", "smartrecruiters", "workday", "workable"}
            source_type = source.adapter if source.adapter in structured_adapters else "company-careers"
            base_url = source.identifier if source.adapter in {"schema-org", "workday"} else f"https://{source.adapter}.io"
            source_input = MarketSourceInput(
                name=source.name,
                source_type=source_type,
                permission_basis=source.permission_basis,
                base_url=base_url,
            )
            persist_market_postings(db, source_input, relevant)
            market_source = db.scalar(
                select(MarketSource).where(
                    MarketSource.name == source_input.name,
                    MarketSource.source_type == source_input.source_type,
                    MarketSource.base_url == str(source_input.base_url),
                )
            )
            if market_source is not None:
                current_urls = [str(item.source_url) for item in relevant]
                stale_query = delete(JobPosting).where(JobPosting.source_id == market_source.id)
                if current_urls:
                    stale_query = stale_query.where(JobPosting.source_url.not_in(current_urls))
                db.execute(stale_query)
            # Keep the user-facing evidence index aligned with every successful source refresh.
            # The indexer skips unchanged content hashes, so recurring runs remain bounded.
            index_job_postings(db)
            run.fetched_count = len(collected)
            run.accepted_count = len(relevant)
            run.rejected_count = len(collected) - len(relevant)
            run.status = "completed"
            run.completed_at = datetime.now(UTC)
            run.locked_at = None
            db.commit()
        except Exception as exc:
            logger.exception("Collector run %s failed", run_id)
            db.rollback()
            run = db.get(CollectorRun, run_id)
            if run is None:
                return
            run.error_message = str(exc)[:1000]
            run.locked_at = None
            if run.attempts >= MAX_ATTEMPTS:
                run.status = "failed"
                run.completed_at = datetime.now(UTC)
            else:
                run.status = "queued"
                run.available_at = datetime.now(UTC) + timedelta(seconds=30 * run.attempts)
            db.commit()
