from datetime import UTC, datetime, timedelta
from pathlib import Path
from typing import Annotated
from uuid import UUID, uuid4

from fastapi import BackgroundTasks, Cookie, Depends, FastAPI, HTTPException, Request, Response, status
from fastapi.middleware.cors import CORSMiddleware
from sqlalchemy import delete, select
from sqlalchemy.orm import Session, selectinload

from .auth import (
    create_access_token,
    current_user,
    hash_password,
    new_refresh_token,
    token_digest,
    verified_user,
    verify_password,
)
from .config import get_settings
from .database import get_db
from .mailer import send_email
from .models import (
    CareerProfile,
    CareerTarget,
    DocumentExtraction,
    EvidenceSource,
    EvidenceSuggestion,
    EvidenceUpload,
    OneTimeToken,
    ProcessingJob,
    RefreshSession,
    User,
)
from .schemas import (
    AuthResponse,
    DeleteAccountRequest,
    DimensionScoreRequest,
    DimensionScoreResponse,
    EmailRequest,
    EvidenceReviewRequest,
    ExtractionResponse,
    LoginRequest,
    ProfileResponse,
    ProfileSetupRequest,
    RegisterRequest,
    ResetPasswordRequest,
    RoleFamily,
    TokenRequest,
    UploadInitiateRequest,
    UploadInitiateResponse,
    UploadResponse,
    UserResponse,
)
from .scoring import calculate_dimension_score
from .security_events import actor_fingerprint, audit, enforce_event_limit, enforce_login_limit
from .storage import delete_object, ensure_bucket, object_metadata, presigned_put

settings = get_settings()
app = FastAPI(title=settings.app_name, version="0.1.0")
app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.allowed_origins,
    allow_credentials=True,
    allow_methods=["GET", "POST", "PUT", "DELETE"],
    allow_headers=["Content-Type", "Authorization"],
)


def create_one_time_token(db: Session, user: User, purpose: str, lifetime: timedelta) -> str:
    raw_token = new_refresh_token()
    db.add(
        OneTimeToken(
            user_id=user.id,
            purpose=purpose,
            token_hash=token_digest(raw_token),
            expires_at=datetime.now(UTC) + lifetime,
        )
    )
    return raw_token


def verification_message(token: str) -> str:
    return (
        f"Verify your CareerSignal email:\n\n{settings.frontend_url}/?verify={token}\n\nThis link expires in 24 hours."
    )


def reset_message(token: str) -> str:
    return (
        f"Reset your CareerSignal password:\n\n{settings.frontend_url}/?reset={token}\n\nThis link expires in 1 hour."
    )


def issue_session(response: Response, user: User, db: Session) -> AuthResponse:
    refresh_token = new_refresh_token()
    expires_at = datetime.now(UTC) + timedelta(days=settings.refresh_token_days)
    db.add(RefreshSession(user_id=user.id, token_hash=token_digest(refresh_token), expires_at=expires_at))
    db.commit()
    response.set_cookie(
        "career_signal_refresh",
        refresh_token,
        httponly=True,
        secure=settings.environment == "production",
        samesite="lax",
        max_age=settings.refresh_token_days * 86400,
        path="/api/v1/auth",
    )
    access_token, expires_in = create_access_token(user.id)
    return AuthResponse(access_token=access_token, expires_in=expires_in, user=UserResponse.model_validate(user))


@app.post("/api/v1/auth/register", response_model=AuthResponse, status_code=status.HTTP_201_CREATED)
def register(
    payload: RegisterRequest,
    request: Request,
    response: Response,
    background: BackgroundTasks,
    db: Annotated[Session, Depends(get_db)],
) -> AuthResponse:
    email = payload.email.lower()
    fingerprint = actor_fingerprint(request)
    enforce_event_limit(db, "auth.registered", fingerprint, 5, 15)
    if db.scalar(select(User.id).where(User.email == email)):
        raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail="An account with this email already exists")
    user = User(email=email, password_hash=hash_password(payload.password), display_name=payload.display_name.strip())
    db.add(user)
    db.commit()
    db.refresh(user)
    token = create_one_time_token(db, user, "verify_email", timedelta(hours=24))
    audit(db, "auth.registered", user_id=user.id, fingerprint=fingerprint)
    result = issue_session(response, user, db)
    background.add_task(send_email, user.email, "Verify your CareerSignal email", verification_message(token))
    return result


@app.post("/api/v1/auth/login", response_model=AuthResponse)
def login(
    payload: LoginRequest,
    request: Request,
    response: Response,
    db: Annotated[Session, Depends(get_db)],
) -> AuthResponse:
    fingerprint = actor_fingerprint(request, payload.email)
    enforce_login_limit(db, fingerprint)
    user = db.scalar(select(User).where(User.email == payload.email.lower(), User.is_active.is_(True)))
    if user is None or not verify_password(payload.password, user.password_hash):
        audit(db, "auth.login_failed", fingerprint=fingerprint)
        db.commit()
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Invalid email or password")
    audit(db, "auth.login_succeeded", user_id=user.id, fingerprint=fingerprint)
    return issue_session(response, user, db)


@app.post("/api/v1/auth/refresh", response_model=AuthResponse)
def refresh_session(
    response: Response,
    db: Annotated[Session, Depends(get_db)],
    refresh_token: Annotated[str | None, Cookie(alias="career_signal_refresh")] = None,
) -> AuthResponse:
    if refresh_token is None:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Refresh session required")
    session = db.scalar(
        select(RefreshSession).where(
            RefreshSession.token_hash == token_digest(refresh_token),
            RefreshSession.revoked_at.is_(None),
            RefreshSession.expires_at > datetime.now(UTC),
        )
    )
    if session is None:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Refresh session is invalid")
    session.revoked_at = datetime.now(UTC)
    user = db.get(User, session.user_id)
    if user is None or not user.is_active:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="User not found")
    return issue_session(response, user, db)


@app.post("/api/v1/auth/logout", status_code=status.HTTP_204_NO_CONTENT)
def logout(
    response: Response,
    db: Annotated[Session, Depends(get_db)],
    refresh_token: Annotated[str | None, Cookie(alias="career_signal_refresh")] = None,
) -> None:
    if refresh_token:
        session = db.scalar(select(RefreshSession).where(RefreshSession.token_hash == token_digest(refresh_token)))
        if session:
            session.revoked_at = datetime.now(UTC)
            db.commit()
    response.delete_cookie("career_signal_refresh", path="/api/v1/auth")


@app.get("/api/v1/auth/me", response_model=UserResponse)
def me(user: Annotated[User, Depends(current_user)]) -> User:
    return user


@app.post("/api/v1/auth/verify-email", status_code=status.HTTP_204_NO_CONTENT)
def verify_email(payload: TokenRequest, db: Annotated[Session, Depends(get_db)]) -> None:
    token = db.scalar(
        select(OneTimeToken).where(
            OneTimeToken.token_hash == token_digest(payload.token),
            OneTimeToken.purpose == "verify_email",
            OneTimeToken.used_at.is_(None),
            OneTimeToken.expires_at > datetime.now(UTC),
        )
    )
    if token is None:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Verification link is invalid or expired")
    user = db.get(User, token.user_id)
    if user is None:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Verification link is invalid")
    user.is_verified = True
    token.used_at = datetime.now(UTC)
    audit(db, "auth.email_verified", user_id=user.id)
    db.commit()


@app.post("/api/v1/auth/resend-verification", status_code=status.HTTP_202_ACCEPTED)
def resend_verification(
    background: BackgroundTasks,
    request: Request,
    user: Annotated[User, Depends(current_user)],
    db: Annotated[Session, Depends(get_db)],
) -> dict[str, str]:
    if user.is_verified:
        return {"status": "already_verified"}
    fingerprint = actor_fingerprint(request, user.email)
    enforce_event_limit(db, "auth.verification_resent", fingerprint, 3, 15)
    db.execute(
        delete(OneTimeToken).where(
            OneTimeToken.user_id == user.id,
            OneTimeToken.purpose == "verify_email",
            OneTimeToken.used_at.is_(None),
        )
    )
    token = create_one_time_token(db, user, "verify_email", timedelta(hours=24))
    audit(db, "auth.verification_resent", user_id=user.id, fingerprint=fingerprint)
    db.commit()
    background.add_task(send_email, user.email, "Verify your CareerSignal email", verification_message(token))
    return {"status": "sent"}


@app.post("/api/v1/auth/forgot-password", status_code=status.HTTP_202_ACCEPTED)
def forgot_password(
    payload: EmailRequest,
    background: BackgroundTasks,
    request: Request,
    db: Annotated[Session, Depends(get_db)],
) -> dict[str, str]:
    fingerprint = actor_fingerprint(request, payload.email)
    enforce_event_limit(db, "auth.password_reset_requested", fingerprint, 3, 15)
    user = db.scalar(select(User).where(User.email == payload.email.lower(), User.is_active.is_(True)))
    if user:
        db.execute(
            delete(OneTimeToken).where(
                OneTimeToken.user_id == user.id,
                OneTimeToken.purpose == "reset_password",
                OneTimeToken.used_at.is_(None),
            )
        )
        token = create_one_time_token(db, user, "reset_password", timedelta(hours=1))
        audit(db, "auth.password_reset_requested", user_id=user.id, fingerprint=fingerprint)
        background.add_task(send_email, user.email, "Reset your CareerSignal password", reset_message(token))
    else:
        audit(db, "auth.password_reset_requested", fingerprint=fingerprint)
    db.commit()
    return {"status": "accepted"}


@app.post("/api/v1/auth/reset-password", status_code=status.HTTP_204_NO_CONTENT)
def reset_password(payload: ResetPasswordRequest, db: Annotated[Session, Depends(get_db)]) -> None:
    token = db.scalar(
        select(OneTimeToken).where(
            OneTimeToken.token_hash == token_digest(payload.token),
            OneTimeToken.purpose == "reset_password",
            OneTimeToken.used_at.is_(None),
            OneTimeToken.expires_at > datetime.now(UTC),
        )
    )
    if token is None:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Reset link is invalid or expired")
    user = db.get(User, token.user_id)
    if user is None:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Reset link is invalid")
    user.password_hash = hash_password(payload.password)
    token.used_at = datetime.now(UTC)
    db.execute(delete(RefreshSession).where(RefreshSession.user_id == user.id))
    audit(db, "auth.password_reset_completed", user_id=user.id)
    db.commit()


@app.get("/health")
def health() -> dict[str, str]:
    return {"status": "ok", "service": "career-signal-api"}


@app.get("/api/v1/roles", response_model=list[RoleFamily])
def roles() -> list[RoleFamily]:
    return [
        RoleFamily(id="software-engineer", label="Software Engineer", status="active"),
        RoleFamily(id="data-bi-analyst", label="Data & BI Analyst", status="active"),
        RoleFamily(id="data-engineer", label="Data Engineer / Analytics Engineer", status="active"),
        RoleFamily(id="ai-application-engineer", label="AI Application Engineer", status="active"),
        RoleFamily(id="cloud-devops", label="Cloud / DevOps Engineer", status="active"),
        RoleFamily(id="qa", label="Quality Engineering", status="planned"),
        RoleFamily(id="it-systems", label="IT and Systems", status="planned"),
        RoleFamily(id="business-technology", label="Business Technology", status="planned"),
        RoleFamily(id="product-ux", label="Product and UX", status="planned"),
        RoleFamily(id="cybersecurity", label="Cybersecurity", status="planned"),
    ]


def profile_response(profile: CareerProfile) -> ProfileResponse:
    primary = next((target for target in profile.targets if target.is_primary), profile.targets[0])
    return ProfileResponse(
        id=profile.id,
        location=profile.location,
        seniority=profile.seniority,
        role_family=primary.role_family,
        evidence_sources=profile.evidence_sources,
        updated_at=profile.updated_at,
    )


@app.put("/api/v1/profile", response_model=ProfileResponse)
def save_profile(
    payload: ProfileSetupRequest,
    user: Annotated[User, Depends(verified_user)],
    db: Annotated[Session, Depends(get_db)],
) -> ProfileResponse:
    profile = db.scalar(
        select(CareerProfile)
        .options(selectinload(CareerProfile.targets), selectinload(CareerProfile.evidence_sources))
        .where(CareerProfile.user_id == user.id)
    )
    if profile is None:
        profile = CareerProfile(user_id=user.id, location=payload.location, seniority=payload.seniority)
        db.add(profile)
        db.flush()
    else:
        profile.location = payload.location
        profile.seniority = payload.seniority
        db.execute(delete(CareerTarget).where(CareerTarget.profile_id == profile.id))
        db.execute(delete(EvidenceSource).where(EvidenceSource.profile_id == profile.id))
    profile.targets = [CareerTarget(role_family=payload.role_family, is_primary=True)]
    profile.evidence_sources = [
        EvidenceSource(source_type=source.source_type, source_reference=str(source.source_reference))
        for source in payload.evidence_sources
    ]
    db.commit()
    return profile_response(
        db.scalar(
            select(CareerProfile)
            .options(selectinload(CareerProfile.targets), selectinload(CareerProfile.evidence_sources))
            .where(CareerProfile.id == profile.id)
        )
    )


@app.get("/api/v1/profile", response_model=ProfileResponse)
def get_profile(
    user: Annotated[User, Depends(verified_user)], db: Annotated[Session, Depends(get_db)]
) -> ProfileResponse:
    profile = db.scalar(
        select(CareerProfile)
        .options(selectinload(CareerProfile.targets), selectinload(CareerProfile.evidence_sources))
        .where(CareerProfile.user_id == user.id)
    )
    if profile is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Profile not created")
    return profile_response(profile)


@app.post("/api/v1/evidence/uploads", response_model=UploadInitiateResponse, status_code=status.HTTP_201_CREATED)
def initiate_upload(
    payload: UploadInitiateRequest,
    user: Annotated[User, Depends(verified_user)],
    db: Annotated[Session, Depends(get_db)],
) -> UploadInitiateResponse:
    suffix = Path(payload.filename).suffix.lower()
    expected_suffix = {
        "application/pdf": ".pdf",
        "application/vnd.openxmlformats-officedocument.wordprocessingml.document": ".docx",
    }[payload.content_type]
    if suffix != expected_suffix:
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_CONTENT, detail="Filename and content type disagree"
        )
    if payload.size > settings.upload_max_bytes:
        raise HTTPException(status_code=status.HTTP_413_CONTENT_TOO_LARGE, detail="File exceeds upload limit")
    ensure_bucket()
    upload_id = uuid4()
    storage_key = f"users/{user.id}/evidence/{upload_id}{expected_suffix}"
    upload = EvidenceUpload(
        id=upload_id,
        user_id=user.id,
        storage_key=storage_key,
        original_filename=Path(payload.filename).name,
        content_type=payload.content_type,
        expected_size=payload.size,
    )
    db.add(upload)
    audit(db, "evidence.upload_initiated", user_id=user.id, metadata={"upload_id": str(upload_id)})
    db.commit()
    return UploadInitiateResponse(
        id=upload.id,
        upload_url=presigned_put(upload.storage_key, upload.content_type, upload.expected_size),
        storage_key=upload.storage_key,
    )


@app.post("/api/v1/evidence/uploads/{upload_id}/complete", response_model=UploadResponse)
def complete_upload(
    upload_id: UUID,
    user: Annotated[User, Depends(verified_user)],
    db: Annotated[Session, Depends(get_db)],
) -> EvidenceUpload:
    upload = db.scalar(select(EvidenceUpload).where(EvidenceUpload.id == upload_id, EvidenceUpload.user_id == user.id))
    if upload is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Upload not found")
    if upload.status != "pending_upload":
        raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail="Upload has already been completed")
    metadata = object_metadata(upload.storage_key)
    actual_size = int(metadata["ContentLength"])
    actual_type = metadata.get("ContentType", "")
    expected_metadata = metadata.get("Metadata", {}).get("expected-size")
    if (
        actual_size != upload.expected_size
        or actual_type != upload.content_type
        or expected_metadata != str(upload.expected_size)
    ):
        delete_object(upload.storage_key)
        upload.status = "rejected"
        upload.failure_reason = "Uploaded object metadata did not match the signed request"
        db.commit()
        raise HTTPException(status_code=status.HTTP_422_UNPROCESSABLE_CONTENT, detail=upload.failure_reason)
    upload.actual_size = actual_size
    upload.status = "queued_for_scan"
    db.add(ProcessingJob(upload_id=upload.id, job_type="virus_scan"))
    audit(db, "evidence.upload_completed", user_id=user.id, metadata={"upload_id": str(upload.id)})
    db.commit()
    db.refresh(upload)
    return upload


@app.get("/api/v1/evidence/uploads", response_model=list[UploadResponse])
def list_uploads(
    user: Annotated[User, Depends(verified_user)], db: Annotated[Session, Depends(get_db)]
) -> list[EvidenceUpload]:
    return list(
        db.scalars(
            select(EvidenceUpload).where(EvidenceUpload.user_id == user.id).order_by(EvidenceUpload.created_at.desc())
        )
    )


@app.get("/api/v1/evidence/uploads/{upload_id}/extraction", response_model=ExtractionResponse)
def get_extraction(
    upload_id: UUID,
    user: Annotated[User, Depends(verified_user)],
    db: Annotated[Session, Depends(get_db)],
) -> ExtractionResponse:
    extraction = db.scalar(
        select(DocumentExtraction)
        .join(EvidenceUpload, EvidenceUpload.id == DocumentExtraction.upload_id)
        .where(DocumentExtraction.upload_id == upload_id, EvidenceUpload.user_id == user.id)
    )
    if extraction is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Extraction not found")
    suggestions = list(
        db.scalars(
            select(EvidenceSuggestion)
            .where(EvidenceSuggestion.extraction_id == extraction.id)
            .order_by(EvidenceSuggestion.category, EvidenceSuggestion.canonical_skill)
        )
    )
    return ExtractionResponse(
        upload_id=upload_id,
        parser_version=extraction.parser_version,
        character_count=extraction.character_count,
        page_count=extraction.page_count,
        suggestions=suggestions,
    )


@app.post("/api/v1/evidence/uploads/{upload_id}/review", response_model=UploadResponse)
def review_extraction(
    upload_id: UUID,
    payload: EvidenceReviewRequest,
    user: Annotated[User, Depends(verified_user)],
    db: Annotated[Session, Depends(get_db)],
) -> EvidenceUpload:
    upload = db.scalar(select(EvidenceUpload).where(EvidenceUpload.id == upload_id, EvidenceUpload.user_id == user.id))
    if upload is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Upload not found")
    if upload.status != "awaiting_review":
        raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail="Evidence is not awaiting review")
    extraction = db.scalar(select(DocumentExtraction).where(DocumentExtraction.upload_id == upload.id))
    if extraction is None:
        raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail="Extraction is unavailable")
    suggestions = list(
        db.scalars(select(EvidenceSuggestion).where(EvidenceSuggestion.extraction_id == extraction.id))
    )
    decisions = {decision.suggestion_id: decision.decision for decision in payload.decisions}
    expected_ids = {suggestion.id for suggestion in suggestions}
    if set(decisions) != expected_ids:
        raise HTTPException(status_code=status.HTTP_422_UNPROCESSABLE_CONTENT, detail="Review every suggestion once")
    reviewed_at = datetime.now(UTC)
    for suggestion in suggestions:
        suggestion.review_status = decisions[suggestion.id]
        suggestion.reviewed_at = reviewed_at
    upload.status = "reviewed"
    audit(
        db,
        "evidence.extraction_reviewed",
        user_id=user.id,
        metadata={
            "upload_id": str(upload.id),
            "confirmed": sum(decision == "confirmed" for decision in decisions.values()),
            "rejected": sum(decision == "rejected" for decision in decisions.values()),
        },
    )
    db.commit()
    db.refresh(upload)
    return upload


@app.delete("/api/v1/evidence/uploads/{upload_id}", status_code=status.HTTP_204_NO_CONTENT)
def remove_upload(
    upload_id: UUID,
    user: Annotated[User, Depends(verified_user)],
    db: Annotated[Session, Depends(get_db)],
) -> None:
    upload = db.scalar(select(EvidenceUpload).where(EvidenceUpload.id == upload_id, EvidenceUpload.user_id == user.id))
    if upload is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Upload not found")
    delete_object(upload.storage_key)
    audit(db, "evidence.upload_deleted", user_id=user.id, metadata={"upload_id": str(upload.id)})
    db.delete(upload)
    db.commit()


@app.get("/api/v1/account/export")
def export_account(user: Annotated[User, Depends(verified_user)], db: Annotated[Session, Depends(get_db)]) -> dict:
    profile = db.scalar(
        select(CareerProfile)
        .options(selectinload(CareerProfile.targets), selectinload(CareerProfile.evidence_sources))
        .where(CareerProfile.user_id == user.id)
    )
    audit(db, "account.exported", user_id=user.id)
    db.commit()
    return {
        "exported_at": datetime.now(UTC).isoformat(),
        "account": {"id": str(user.id), "email": user.email, "display_name": user.display_name},
        "profile": profile_response(profile).model_dump(mode="json") if profile else None,
    }


@app.delete("/api/v1/account", status_code=status.HTTP_204_NO_CONTENT)
def delete_account(
    payload: DeleteAccountRequest,
    response: Response,
    user: Annotated[User, Depends(current_user)],
    db: Annotated[Session, Depends(get_db)],
) -> None:
    if not verify_password(payload.password, user.password_hash):
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Password is incorrect")
    storage_keys = list(db.scalars(select(EvidenceUpload.storage_key).where(EvidenceUpload.user_id == user.id)))
    try:
        for storage_key in storage_keys:
            delete_object(storage_key)
    except Exception as exc:
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail="Private files could not be deleted; the account was preserved",
        ) from exc
    audit(db, "account.deleted", user_id=user.id)
    db.flush()
    db.delete(user)
    db.commit()
    response.delete_cookie("career_signal_refresh", path="/api/v1/auth")


@app.post("/api/v1/scoring/dimension", response_model=DimensionScoreResponse)
def score_dimension(payload: DimensionScoreRequest) -> DimensionScoreResponse:
    result = calculate_dimension_score(payload)
    return DimensionScoreResponse(
        **result.__dict__,
        context={
            "target_role": payload.target_role,
            "location": payload.location,
            "seniority": payload.seniority,
            "market_window_days": payload.market_window_days,
        },
    )
