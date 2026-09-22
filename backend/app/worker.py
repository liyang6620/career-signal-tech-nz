import logging
import tempfile
import time
from datetime import UTC, datetime, timedelta

import clamd
from sqlalchemy import and_, or_, select

from .config import get_settings
from .database import SessionLocal
from .models import EvidenceUpload, ProcessingJob
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
                upload.status = "scan_failed"
                upload.failure_reason = "File security scan failed"
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
                upload.status = "clean"
                upload.failure_reason = None
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


if __name__ == "__main__":
    run()
