import logging
import tempfile
import time
from datetime import UTC, datetime, timedelta

import clamd
from sqlalchemy import and_, or_, select
from sqlalchemy.orm import Session

from .config import get_settings
from .database import SessionLocal
from .extraction import PARSER_VERSION, ParsedDocument, SuggestedEvidence, parse_document, suggest_evidence
from .mailer import send_email
from .market_ingestion import MAX_ATTEMPTS as COLLECTOR_MAX_ATTEMPTS
from .market_ingestion import RUN_LEASE, execute_collector_run
from .models import (
    CandidateSkillEvidence,
    CollectorRun,
    CollectorSource,
    DocumentExtraction,
    EmailOutbox,
    EvidenceSuggestion,
    EvidenceUpload,
    ProcessingJob,
)
from .storage import delete_object, download_object, ensure_bucket

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)
MAX_ATTEMPTS = 3
JOB_LEASE = timedelta(minutes=5)
EMAIL_LEASE = timedelta(minutes=5)
EMAIL_MAX_ATTEMPTS = 5
SCHEDULE_CHECK_SECONDS = 30


def valid_file_signature(content_type: str, signature: bytes) -> bool:
    expected = {
        "application/pdf": b"%PDF",
        "application/vnd.openxmlformats-officedocument.wordprocessingml.document": b"PK\x03\x04",
    }
    return expected.get(content_type) == signature


def malware_verdict(file_object, upload_id, settings) -> tuple[str, str | None]:
    if settings.malware_scan_mode == "trusted_demo":
        logger.warning(
            "Trusted demo upload mode accepted signature-validated file %s without malware scanning",
            upload_id,
        )
        return "OK", None
    file_object.seek(0)
    result = clamd.ClamdNetworkSocket(settings.clamav_host, settings.clamav_port).instream(file_object)
    return next(iter(result.values()))


def claim_job() -> ProcessingJob | None:
    now = datetime.now(UTC)
    with SessionLocal() as db:
        job = db.scalar(
            select(ProcessingJob)
            .where(
                or_(
                    ProcessingJob.status == "queued",
                    and_(
                        ProcessingJob.status == "processing",
                        ProcessingJob.locked_at < now - JOB_LEASE,
                    ),
                ),
                ProcessingJob.available_at <= datetime.now(UTC),
            )
            .order_by(ProcessingJob.created_at)
            .with_for_update(skip_locked=True)
        )
        if job is None:
            return None
        if job.attempts >= MAX_ATTEMPTS:
            job.status = "failed"
            job.last_error = "Processing lease expired after maximum attempts"
            upload = db.get(EvidenceUpload, job.upload_id)
            if upload is not None:
                is_parse = job.job_type == "document_parse"
                upload.status = "parse_failed" if is_parse else "scan_failed"
                upload.failure_reason = (
                    "Document text could not be extracted" if is_parse else "File security scan failed"
                )
            db.commit()
            return None
        job.status = "processing"
        job.locked_at = now
        job.attempts += 1
        db.commit()
        db.refresh(job)
        return job


def claim_collector_run() -> CollectorRun | None:
    now = datetime.now(UTC)
    with SessionLocal() as db:
        run = db.scalar(
            select(CollectorRun)
            .where(
                or_(
                    CollectorRun.status == "queued",
                    and_(CollectorRun.status == "processing", CollectorRun.locked_at < now - RUN_LEASE),
                ),
                CollectorRun.available_at <= now,
            )
            .order_by(CollectorRun.started_at)
            .with_for_update(skip_locked=True)
        )
        if run is None:
            return None
        if run.attempts >= COLLECTOR_MAX_ATTEMPTS:
            run.status = "failed"
            run.error_message = "Collector lease expired after maximum attempts"
            run.completed_at = now
            db.commit()
            return None
        run.status = "processing"
        run.locked_at = now
        run.attempts += 1
        db.commit()
        return run


def schedule_due_collector_runs(limit: int = 20) -> int:
    """Materialise due source schedules as durable runs without creating duplicates."""
    now = datetime.now(UTC)
    scheduled = 0
    with SessionLocal() as db:
        sources = list(
            db.scalars(
                select(CollectorSource)
                .where(CollectorSource.enabled.is_(True), CollectorSource.next_run_at <= now)
                .order_by(CollectorSource.next_run_at)
                .limit(limit)
                .with_for_update(skip_locked=True)
            )
        )
        if not sources:
            return 0
        active_source_ids = set(
            db.scalars(
                select(CollectorRun.collector_source_id).where(
                    CollectorRun.collector_source_id.in_(source.id for source in sources),
                    CollectorRun.status.in_(("queued", "processing")),
                )
            )
        )
        for source in sources:
            if source.id in active_source_ids:
                continue
            if source.last_enqueued_at is not None:
                minimum_next = source.last_enqueued_at + timedelta(seconds=source.minimum_interval_seconds)
                if minimum_next > now:
                    source.next_run_at = minimum_next
                    continue
            db.add(CollectorRun(collector_source_id=source.id, status="queued"))
            source.last_enqueued_at = now
            source.next_run_at = now + timedelta(minutes=source.refresh_interval_minutes)
            scheduled += 1
        db.commit()
    return scheduled


def claim_email() -> EmailOutbox | None:
    now = datetime.now(UTC)
    with SessionLocal() as db:
        message = db.scalar(
            select(EmailOutbox)
            .where(
                or_(
                    EmailOutbox.status == "queued",
                    and_(EmailOutbox.status == "sending", EmailOutbox.locked_at < now - EMAIL_LEASE),
                ),
                EmailOutbox.available_at <= now,
            )
            .order_by(EmailOutbox.created_at)
            .with_for_update(skip_locked=True)
        )
        if message is None:
            return None
        if message.attempts >= EMAIL_MAX_ATTEMPTS:
            message.status = "failed"
            message.last_error = "Email lease expired after maximum attempts"
            db.commit()
            return None
        message.status = "sending"
        message.locked_at = now
        message.attempts += 1
        db.commit()
        return message


def process_email(message: EmailOutbox) -> None:
    with SessionLocal() as db:
        persisted = db.get(EmailOutbox, message.id)
        if persisted is None:
            return
        try:
            send_email(persisted.recipient, persisted.subject, persisted.body)
            persisted.status = "sent"
            persisted.sent_at = datetime.now(UTC)
            persisted.locked_at = None
            persisted.last_error = None
        except Exception as exc:
            logger.exception("Email delivery failed for outbox item %s", message.id)
            persisted.locked_at = None
            persisted.last_error = str(exc)[:2000]
            if persisted.attempts >= EMAIL_MAX_ATTEMPTS:
                persisted.status = "failed"
            else:
                persisted.status = "queued"
                persisted.available_at = datetime.now(UTC) + timedelta(seconds=30 * persisted.attempts)
        db.commit()


def process_scan(job: ProcessingJob) -> None:
    settings = get_settings()
    with SessionLocal() as db:
        persisted_job = db.get(ProcessingJob, job.id)
        upload = db.get(EvidenceUpload, job.upload_id)
        if persisted_job is None or upload is None:
            return
        try:
            upload.status = "scanning"
            db.commit()
            with tempfile.SpooledTemporaryFile(max_size=settings.upload_max_bytes) as file_object:
                download_object(upload.storage_key, file_object)
                file_object.seek(0)
                signature = file_object.read(4)
                if not valid_file_signature(upload.content_type, signature):
                    delete_object(upload.storage_key)
                    upload.status = "rejected"
                    upload.failure_reason = "File content does not match its declared type"
                    persisted_job.status = "completed"
                    db.commit()
                    return
                verdict, signature = malware_verdict(file_object, upload.id, settings)
            if verdict == "FOUND":
                delete_object(upload.storage_key)
                upload.status = "rejected"
                upload.failure_reason = f"Malware detected: {signature}"[:255]
            elif verdict == "OK":
                upload.status = "queued_for_parsing"
                upload.failure_reason = None
                db.add(ProcessingJob(upload_id=upload.id, job_type="document_parse"))
            else:
                raise RuntimeError(f"Unexpected scanner verdict: {verdict}")
            persisted_job.status = "completed"
            db.commit()
        except Exception as exc:
            logger.exception("Upload scan failed for job %s", job.id)
            persisted_job.last_error = str(exc)[:2000]
            if persisted_job.attempts >= MAX_ATTEMPTS:
                persisted_job.status = "failed"
                upload.status = "scan_failed"
                upload.failure_reason = "File security scan failed"
            else:
                persisted_job.status = "queued"
                persisted_job.available_at = datetime.now(UTC) + timedelta(seconds=30 * persisted_job.attempts)
            db.commit()


def process_parse(job: ProcessingJob) -> None:
    with SessionLocal() as db:
        persisted_job = db.get(ProcessingJob, job.id)
        upload = db.get(EvidenceUpload, job.upload_id)
        if persisted_job is None or upload is None:
            return
        try:
            upload.status = "parsing"
            db.commit()
            suffix = ".pdf" if upload.content_type == "application/pdf" else ".docx"
            with tempfile.NamedTemporaryFile(suffix=suffix) as file_object:
                download_object(upload.storage_key, file_object)
                file_object.flush()
                parsed = parse_document(file_object.name, upload.content_type)
            suggestions = suggest_evidence(parsed.text)
            persist_parsed_evidence(db, upload, parsed, suggestions)
            upload.failure_reason = None
            persisted_job.status = "completed"
            db.commit()
        except Exception as exc:
            logger.exception("Document parsing failed for job %s", job.id)
            persisted_job.last_error = str(exc)[:2000]
            if persisted_job.attempts >= MAX_ATTEMPTS:
                persisted_job.status = "failed"
                upload.status = "parse_failed"
                upload.failure_reason = "Document text could not be extracted"
            else:
                persisted_job.status = "queued"
                persisted_job.available_at = datetime.now(UTC) + timedelta(seconds=30 * persisted_job.attempts)
            db.commit()


def persist_parsed_evidence(
    db: Session,
    upload: EvidenceUpload,
    parsed: ParsedDocument,
    suggestions: list[SuggestedEvidence],
) -> None:
    """Create or refresh extraction records while preserving explicit user decisions."""
    extraction = db.scalar(select(DocumentExtraction).where(DocumentExtraction.upload_id == upload.id))
    if extraction is None:
        extraction = DocumentExtraction(
            upload_id=upload.id,
            parser_version=PARSER_VERSION,
            text_sha256=parsed.text_sha256,
            character_count=parsed.character_count,
            page_count=parsed.page_count,
        )
        db.add(extraction)
        db.flush()
        db.add_all(
            EvidenceSuggestion(
                extraction_id=extraction.id,
                canonical_skill=item.skill,
                category=item.category,
                excerpt=item.excerpt,
                locator=item.locator,
                confidence=item.confidence,
                proposed_level=item.proposed_level,
            )
            for item in suggestions
        )
        upload.status = "awaiting_review" if suggestions else "parsed_no_evidence"
        return

    extraction.parser_version = PARSER_VERSION
    extraction.text_sha256 = parsed.text_sha256
    extraction.character_count = parsed.character_count
    extraction.page_count = parsed.page_count
    existing = {
        item.canonical_skill: item
        for item in db.scalars(select(EvidenceSuggestion).where(EvidenceSuggestion.extraction_id == extraction.id))
    }
    has_pending_review = any(item.review_status == "pending" for item in existing.values())
    for item in suggestions:
        stored = existing.get(item.skill)
        if stored is None:
            db.add(
                EvidenceSuggestion(
                    extraction_id=extraction.id,
                    canonical_skill=item.skill,
                    category=item.category,
                    excerpt=item.excerpt,
                    locator=item.locator,
                    confidence=item.confidence,
                    proposed_level=item.proposed_level,
                )
            )
            has_pending_review = True
            continue
        stored.category = item.category
        stored.excerpt = item.excerpt
        stored.locator = item.locator
        stored.confidence = item.confidence
        stored.proposed_level = item.proposed_level
        if stored.review_status == "confirmed":
            evidence = db.scalar(
                select(CandidateSkillEvidence).where(CandidateSkillEvidence.suggestion_id == stored.id)
            )
            if evidence is not None:
                evidence.evidence_level = item.proposed_level
                evidence.confidence = item.confidence
                evidence.excerpt = item.excerpt
                evidence.locator = item.locator
    upload.status = "awaiting_review" if has_pending_review else "reviewed"


def enqueue_stale_extractions() -> int:
    """Queue documents produced by an older parser without discarding review decisions."""
    queued = 0
    with SessionLocal() as db:
        active_upload_ids = set(db.scalars(
            select(ProcessingJob.upload_id).where(ProcessingJob.status.in_(("queued", "processing")))
        ))
        stale_uploads = list(db.scalars(
            select(EvidenceUpload)
            .join(DocumentExtraction, DocumentExtraction.upload_id == EvidenceUpload.id)
            .where(
                DocumentExtraction.parser_version != PARSER_VERSION,
                EvidenceUpload.status.in_(("reviewed", "awaiting_review", "parsed_no_evidence")),
            )
        ))
        for upload in stale_uploads:
            if upload.id in active_upload_ids:
                continue
            upload.status = "queued_for_parsing"
            db.add(ProcessingJob(upload_id=upload.id, job_type="document_parse"))
            queued += 1
        db.commit()
    return queued


def run() -> None:
    ensure_bucket()
    logger.info("Evidence worker started")
    queued = enqueue_stale_extractions()
    if queued:
        logger.info("Queued %s stale document extractions for parser %s", queued, PARSER_VERSION)
    last_schedule_check = 0.0
    while True:
        monotonic_now = time.monotonic()
        if monotonic_now - last_schedule_check >= SCHEDULE_CHECK_SECONDS:
            scheduled = schedule_due_collector_runs()
            if scheduled:
                logger.info("Scheduled %s recurring collector runs", scheduled)
            last_schedule_check = monotonic_now
        job = claim_job()
        if job is not None:
            if job.job_type == "virus_scan":
                process_scan(job)
            elif job.job_type == "document_parse":
                process_parse(job)
            else:
                logger.error("Unsupported processing job type %s", job.job_type)
            continue
        run_job = claim_collector_run()
        if run_job is not None:
            execute_collector_run(run_job.id)
            continue
        message = claim_email()
        if message is not None:
            process_email(message)
            continue
        time.sleep(2)


if __name__ == "__main__":
    run()
