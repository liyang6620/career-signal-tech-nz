import logging
import tempfile
import time
from datetime import UTC, datetime, timedelta

import clamd
from sqlalchemy import and_, or_, select

from .config import get_settings
from .database import SessionLocal
from .extraction import PARSER_VERSION, parse_document, suggest_evidence
from .models import DocumentExtraction, EvidenceSuggestion, EvidenceUpload, ProcessingJob
from .storage import delete_object, download_object, ensure_bucket

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)
MAX_ATTEMPTS = 3
JOB_LEASE = timedelta(minutes=5)


def valid_file_signature(content_type: str, signature: bytes) -> bool:
    expected = {
        "application/pdf": b"%PDF",
        "application/vnd.openxmlformats-officedocument.wordprocessingml.document": b"PK\x03\x04",
    }
    return expected.get(content_type) == signature


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
                file_object.seek(0)
                result = clamd.ClamdNetworkSocket(settings.clamav_host, settings.clamav_port).instream(file_object)
            verdict, signature = next(iter(result.values()))
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
            extraction = DocumentExtraction(
                upload_id=upload.id,
                parser_version=PARSER_VERSION,
                text_sha256=parsed.text_sha256,
                character_count=parsed.character_count,
                page_count=parsed.page_count,
            )
            db.add(extraction)
            db.flush()
            suggestions = suggest_evidence(parsed.text)
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


def run() -> None:
    ensure_bucket()
    logger.info("Evidence worker started")
    while True:
        job = claim_job()
        if job is None:
            time.sleep(2)
            continue
        if job.job_type == "virus_scan":
            process_scan(job)
        elif job.job_type == "document_parse":
            process_parse(job)
        else:
            logger.error("Unsupported processing job type %s", job.job_type)


if __name__ == "__main__":
    run()
