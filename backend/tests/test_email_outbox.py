from datetime import UTC, datetime, timedelta

import pytest
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker
from sqlalchemy.pool import StaticPool

from app.database import Base
from app.mailer import enqueue_email
from app.models import EmailOutbox
from app.worker import claim_email, process_email


@pytest.fixture
def session_factory():
    engine = create_engine("sqlite://", connect_args={"check_same_thread": False}, poolclass=StaticPool)
    factory = sessionmaker(bind=engine, expire_on_commit=False)
    Base.metadata.create_all(engine)
    yield factory
    Base.metadata.drop_all(engine)


def test_email_outbox_retries_then_marks_message_sent(
    session_factory,
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    with session_factory() as db:
        message = enqueue_email(db, "candidate@example.com", "Verify", "Verify link")
        db.commit()
        message_id = message.id

    monkeypatch.setattr("app.worker.SessionLocal", session_factory)
    attempts = 0

    def fail_once(*args: str) -> None:
        nonlocal attempts
        attempts += 1
        raise RuntimeError("smtp unavailable")

    monkeypatch.setattr("app.worker.send_email", fail_once)
    claimed = claim_email()
    assert claimed is not None
    process_email(claimed)

    with session_factory() as db:
        failed_delivery = db.get(EmailOutbox, message_id)
        assert failed_delivery is not None
        assert failed_delivery.status == "queued"
        assert failed_delivery.attempts == 1
        assert failed_delivery.last_error == "smtp unavailable"
        failed_delivery.available_at = datetime.now(UTC) - timedelta(seconds=1)
        db.commit()

    monkeypatch.setattr("app.worker.send_email", lambda *args: None)
    claimed = claim_email()
    assert claimed is not None
    process_email(claimed)

    with session_factory() as db:
        delivered = db.get(EmailOutbox, message_id)
        assert delivered is not None
        assert delivered.status == "sent"
        assert delivered.sent_at is not None
        assert attempts == 1
