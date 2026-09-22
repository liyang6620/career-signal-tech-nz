import hashlib
import hmac
import json
import uuid
from datetime import UTC, datetime, timedelta

from fastapi import HTTPException, Request, status
from sqlalchemy import func, select
from sqlalchemy.orm import Session

from .config import get_settings
from .models import AuditEvent

LOGIN_WINDOW_MINUTES = 15
LOGIN_FAILURE_LIMIT = 5


def actor_fingerprint(request: Request, email: str = "") -> str:
    forwarded = request.headers.get("x-forwarded-for", "").split(",")[0].strip()
    host = forwarded or (request.client.host if request.client else "unknown")
    value = f"{host}|{email.casefold()}".encode()
    return hmac.new(get_settings().jwt_secret.encode(), value, hashlib.sha256).hexdigest()


def audit(
    db: Session,
    event_type: str,
    *,
    user_id: uuid.UUID | None = None,
    fingerprint: str | None = None,
    metadata: dict[str, str] | None = None,
) -> None:
    db.add(
        AuditEvent(
            user_id=user_id,
            event_type=event_type,
            actor_fingerprint=fingerprint,
            event_metadata=json.dumps(metadata, separators=(",", ":")) if metadata else None,
        )
    )


def enforce_login_limit(db: Session, fingerprint: str) -> None:
    enforce_event_limit(db, "auth.login_failed", fingerprint, LOGIN_FAILURE_LIMIT, LOGIN_WINDOW_MINUTES)


def enforce_event_limit(db: Session, event_type: str, fingerprint: str, limit: int, window_minutes: int) -> None:
    cutoff = datetime.now(UTC) - timedelta(minutes=window_minutes)
    event_count = db.scalar(
        select(func.count(AuditEvent.id)).where(
            AuditEvent.event_type == event_type,
            AuditEvent.actor_fingerprint == fingerprint,
            AuditEvent.created_at >= cutoff,
        )
    )
    if event_count and event_count >= limit:
        raise HTTPException(
            status_code=status.HTTP_429_TOO_MANY_REQUESTS,
            detail="Too many requests. Try again later.",
            headers={"Retry-After": str(window_minutes * 60)},
        )
