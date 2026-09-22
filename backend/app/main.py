import hashlib
import json
from datetime import UTC, datetime, timedelta
from pathlib import Path
from typing import Annotated
from uuid import UUID, uuid4

from fastapi import BackgroundTasks, Cookie, Depends, FastAPI, Header, HTTPException, Request, Response, status
from fastapi.middleware.cors import CORSMiddleware
from sqlalchemy import delete, desc, func, select
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
from .collectors import collect, is_new_zealand_location
from .config import get_settings
from .database import get_db
from .github import fetch_snapshot, suggest_github_evidence
from .mailer import send_email
from .models import (
    CandidateSkillEvidence,
    CanonicalSkill,
    CareerProfile,
    CareerTarget,
    CollectorRun,
    CollectorSource,
    DocumentExtraction,
    EvidenceSource,
    EvidenceSuggestion,
    EvidenceUpload,
    GithubProject,
    GithubSuggestion,
    JobChunk,
    JobPosting,
    JobPostingSkill,
    MarketSource,
    OneTimeToken,
    ProcessingJob,
    RefreshSession,
    User,
)
from .rag import embed_query, index_job_postings, search_job_evidence
from .rag_eval import evaluate_retrieval
from .role_decoder import ROLE_LABELS, decode_role
from .schemas import (
    AuthResponse,
    CollectorRunResponse,
    CollectorSourceRequest,
    CollectorSourceResponse,
    DeleteAccountRequest,
    DimensionScoreRequest,
    DimensionScoreResponse,
    EmailRequest,
    EvidenceCitation,
    EvidenceReviewRequest,
    EvidenceSearchRequest,
    EvidenceSearchResponse,
    ExtractionResponse,
    GithubProjectRequest,
    GithubProjectResponse,
    JobPostingInput,
    LoginRequest,
    MarketImportRequest,
    MarketQualityResponse,
    MarketSourceInput,
    MarketSummaryResponse,
    ProfileResponse,
    ProfileSetupRequest,
    RagEvaluationResponse,
    RagIndexRequest,
    RagIndexResponse,
    RegisterRequest,
    ResetPasswordRequest,
    RoleDecodeRequest,
    RoleDecodeResponse,
    RoleFamily,
    RoleFitResponse,
    SkillEvidenceResponse,
    SkillGraphResponse,
    TokenRequest,
    UploadInitiateRequest,
    UploadInitiateResponse,
    UploadResponse,
    UserResponse,
)
from .scoring import calculate_dimension_score
from .security_events import actor_fingerprint, audit, enforce_event_limit, enforce_login_limit
from .storage import delete_object, ensure_bucket, object_metadata, presigned_put
from .taxonomy import ROLE_REQUIREMENTS, SKILLS, slug_for_name

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


@app.post("/api/v1/role-decoder", response_model=RoleDecodeResponse)
def role_decoder(payload: RoleDecodeRequest, user: Annotated[User, Depends(verified_user)]) -> RoleDecodeResponse:
    decoded = decode_role(payload.title, payload.description)
    return RoleDecodeResponse(
        role_family=decoded.role_family,
        role_label=decoded.role_label,
        confidence=decoded.confidence,
        seniority=decoded.seniority,
        matched_skills=[
            {"slug": slug, "name": name, "mention_count": count}
            for slug, name, count in decoded.matched_skills
        ],
        alternatives=[
            {"role_family": role, "role_label": ROLE_LABELS[role], "score_share": share}
            for role, share in decoded.alternatives
        ],
    )


def require_ingestion_key(ingestion_key: str | None) -> None:
    if ingestion_key != settings.ingestion_api_key:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Invalid ingestion credential")


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


@app.post("/api/v1/market/import", status_code=status.HTTP_202_ACCEPTED)
def import_market_postings(
    payload: MarketImportRequest,
    db: Annotated[Session, Depends(get_db)],
    ingestion_key: Annotated[str | None, Header(alias="X-Ingestion-Key")] = None,
) -> dict[str, int]:
    require_ingestion_key(ingestion_key)
    result = persist_market_postings(db, payload.source, payload.postings)
    db.commit()
    return result


@app.post(
    "/api/v1/market/collectors",
    response_model=CollectorSourceResponse,
    status_code=status.HTTP_201_CREATED,
)
def create_collector_source(
    payload: CollectorSourceRequest,
    db: Annotated[Session, Depends(get_db)],
    ingestion_key: Annotated[str | None, Header(alias="X-Ingestion-Key")] = None,
) -> CollectorSource:
    require_ingestion_key(ingestion_key)
    existing = db.scalar(
        select(CollectorSource).where(
            CollectorSource.adapter == payload.adapter,
            CollectorSource.identifier == payload.identifier,
        )
    )
    if existing:
        raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail="Collector source already exists")
    source = CollectorSource(**payload.model_dump())
    db.add(source)
    db.commit()
    db.refresh(source)
    return source


@app.get("/api/v1/market/collectors", response_model=list[CollectorSourceResponse])
def list_collector_sources(
    db: Annotated[Session, Depends(get_db)],
    ingestion_key: Annotated[str | None, Header(alias="X-Ingestion-Key")] = None,
) -> list[CollectorSource]:
    require_ingestion_key(ingestion_key)
    return list(db.scalars(select(CollectorSource).order_by(CollectorSource.created_at.desc())))


@app.post("/api/v1/market/collectors/{source_id}/run", response_model=CollectorRunResponse)
def run_collector_source(
    source_id: UUID,
    db: Annotated[Session, Depends(get_db)],
    ingestion_key: Annotated[str | None, Header(alias="X-Ingestion-Key")] = None,
) -> CollectorRun:
    require_ingestion_key(ingestion_key)
    source = db.get(CollectorSource, source_id)
    if source is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Collector source not found")
    if not source.enabled:
        raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail="Collector source is disabled")
    run = CollectorRun(collector_source_id=source.id, status="running")
    db.add(run)
    db.commit()
    db.refresh(run)
    try:
        collected = collect(source.adapter, source.identifier, source.company)
        accepted = [item for item in collected if is_new_zealand_location(item.location)]
        valid: list[JobPostingInput] = []
        for item in accepted:
            try:
                valid.append(JobPostingInput.model_validate(item.__dict__))
            except ValueError:
                continue
        source_type = source.adapter if source.adapter in {"greenhouse", "lever"} else "company-careers"
        base_url = source.identifier if source.adapter == "schema-org" else f"https://{source.adapter}.io"
        persist_market_postings(
            db,
            MarketSourceInput(
                name=source.name,
                source_type=source_type,
                permission_basis=source.permission_basis,
                base_url=base_url,
            ),
            valid,
        )
        run.fetched_count = len(collected)
        run.accepted_count = len(valid)
        run.rejected_count = len(collected) - len(valid)
        run.status = "completed"
        run.completed_at = datetime.now(UTC)
        db.commit()
        db.refresh(run)
        return run
    except Exception as exc:
        db.rollback()
        run = db.get(CollectorRun, run.id)
        if run is not None:
            run.status = "failed"
            run.error_message = str(exc)[:1000]
            run.completed_at = datetime.now(UTC)
            db.commit()
        raise HTTPException(status_code=status.HTTP_502_BAD_GATEWAY, detail="Collector run failed") from exc


@app.get("/api/v1/market/summary", response_model=MarketSummaryResponse)
def market_summary(
    user: Annotated[User, Depends(verified_user)],
    db: Annotated[Session, Depends(get_db)],
) -> MarketSummaryResponse:
    roles = db.execute(
        select(JobPosting.role_family, func.count(JobPosting.id))
        .group_by(JobPosting.role_family)
        .order_by(desc(func.count(JobPosting.id)))
    ).all()
    locations = db.execute(
        select(JobPosting.location, func.count(JobPosting.id))
        .group_by(JobPosting.location)
        .order_by(desc(func.count(JobPosting.id)))
    ).all()
    skills = db.execute(
        select(JobPostingSkill.skill_slug, func.count(JobPostingSkill.posting_id))
        .group_by(JobPostingSkill.skill_slug)
        .order_by(desc(func.count(JobPostingSkill.posting_id)))
        .limit(15)
    ).all()
    return MarketSummaryResponse(
        posting_count=db.scalar(select(func.count(JobPosting.id))) or 0,
        roles=[{"role_family": role, "count": count} for role, count in roles],
        locations=[{"location": location, "count": count} for location, count in locations],
        top_skills=[{"skill_slug": slug, "skill_name": SKILLS[slug][0], "count": count} for slug, count in skills],
    )


@app.get("/api/v1/market/quality", response_model=MarketQualityResponse)
def market_quality(
    user: Annotated[User, Depends(verified_user)],
    db: Annotated[Session, Depends(get_db)],
) -> MarketQualityResponse:
    posting_count = db.scalar(select(func.count(JobPosting.id))) or 0
    missing_dates = db.scalar(
        select(func.count(JobPosting.id)).where(JobPosting.published_at.is_(None))
    ) or 0
    stale_before = datetime.now(UTC) - timedelta(days=90)
    sources = list(db.scalars(select(CollectorSource).order_by(CollectorSource.name)))
    source_quality: list[dict[str, str | int | bool | None]] = []
    for source in sources:
        latest = db.scalar(
            select(CollectorRun)
            .where(CollectorRun.collector_source_id == source.id)
            .order_by(CollectorRun.started_at.desc())
            .limit(1)
        )
        source_quality.append(
            {
                "name": source.name,
                "adapter": source.adapter,
                "enabled": source.enabled,
                "latest_status": latest.status if latest else None,
                "last_run_at": latest.started_at.isoformat() if latest else None,
                "accepted_count": latest.accepted_count if latest else 0,
                "rejected_count": latest.rejected_count if latest else 0,
            }
        )
    return MarketQualityResponse(
        posting_count=posting_count,
        missing_publication_date_percent=round((missing_dates / posting_count * 100) if posting_count else 0, 1),
        low_confidence_count=db.scalar(
            select(func.count(JobPosting.id)).where(JobPosting.classification_confidence < 0.5)
        )
        or 0,
        stale_posting_count=db.scalar(
            select(func.count(JobPosting.id)).where(
                JobPosting.published_at.is_not(None), JobPosting.published_at < stale_before
            )
        )
        or 0,
        duplicate_url_count=0,
        collector_completed_count=db.scalar(
            select(func.count(CollectorRun.id)).where(CollectorRun.status == "completed")
        )
        or 0,
        collector_failed_count=db.scalar(
            select(func.count(CollectorRun.id)).where(CollectorRun.status == "failed")
        )
        or 0,
        sources=source_quality,
    )


@app.post("/api/v1/rag/index", response_model=RagIndexResponse)
def index_market_evidence(
    payload: RagIndexRequest,
    db: Annotated[Session, Depends(get_db)],
    ingestion_key: Annotated[str | None, Header(alias="X-Ingestion-Key")] = None,
) -> RagIndexResponse:
    require_ingestion_key(ingestion_key)
    return RagIndexResponse(**index_job_postings(db, limit=payload.limit))


@app.post("/api/v1/rag/search", response_model=EvidenceSearchResponse)
def search_market_evidence(
    payload: EvidenceSearchRequest,
    user: Annotated[User, Depends(verified_user)],
    db: Annotated[Session, Depends(get_db)],
) -> EvidenceSearchResponse:
    if not db.scalar(select(func.count(JobChunk.id))):
        return EvidenceSearchResponse(query=payload.query, result_count=0, citations=[])
    vector = embed_query(payload.query)
    published_after = (
        datetime.now(UTC) - timedelta(days=payload.market_window_days)
        if payload.market_window_days is not None
        else None
    )
    rows = search_job_evidence(
        db,
        payload.query,
        vector,
        role_family=payload.role_family,
        location=payload.location,
        seniority=payload.seniority,
        published_after=published_after,
        limit=payload.limit,
    )
    citations = [
        EvidenceCitation(
            citation_id=f"J{index}",
            title=row["title"],
            company=row["company"],
            location=row["location"],
            role_family=row["role_family"],
            seniority=row["seniority"],
            source_url=row["source_url"],
            published_at=row["published_at"],
            excerpt=row["content"],
            retrieval_score=round(float(row["hybrid_score"]), 6),
        )
        for index, row in enumerate(rows, start=1)
    ]
    return EvidenceSearchResponse(query=payload.query, result_count=len(citations), citations=citations)


@app.post("/api/v1/rag/evaluate", response_model=RagEvaluationResponse)
def evaluate_market_retrieval(
    db: Annotated[Session, Depends(get_db)],
    ingestion_key: Annotated[str | None, Header(alias="X-Ingestion-Key")] = None,
) -> RagEvaluationResponse:
    require_ingestion_key(ingestion_key)
    return RagEvaluationResponse(**evaluate_retrieval(db))


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
        if decisions[suggestion.id] == "confirmed":
            skill_slug = slug_for_name(suggestion.canonical_skill)
            if skill_slug is not None:
                db.add(
                    CandidateSkillEvidence(
                        user_id=user.id,
                        upload_id=upload.id,
                        suggestion_id=suggestion.id,
                        skill_slug=skill_slug,
                        evidence_level=suggestion.proposed_level,
                        confidence=suggestion.confidence,
                        excerpt=suggestion.excerpt,
                        locator=suggestion.locator,
                    )
                )
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


@app.get("/api/v1/evidence/graph", response_model=SkillGraphResponse)
def evidence_graph(
    role_family: str,
    user: Annotated[User, Depends(verified_user)],
    db: Annotated[Session, Depends(get_db)],
) -> SkillGraphResponse:
    if role_family not in ROLE_REQUIREMENTS:
        raise HTTPException(status_code=status.HTTP_422_UNPROCESSABLE_CONTENT, detail="Unknown role family")
    items = list(db.scalars(
        select(CandidateSkillEvidence)
        .where(CandidateSkillEvidence.user_id == user.id)
        .order_by(CandidateSkillEvidence.skill_slug)
    ))
    return SkillGraphResponse(
        role_family=role_family,
        evidence=[
            SkillEvidenceResponse(
                skill_slug=item.skill_slug,
                skill_name=SKILLS[item.skill_slug][0],
                category=SKILLS[item.skill_slug][1],
                evidence_level=item.evidence_level,
                confidence=item.confidence,
                excerpt=item.excerpt,
                locator=item.locator,
                source_type=item.source_type,
            )
            for item in items
        ],
    )


@app.post("/api/v1/evidence/github", response_model=GithubProjectResponse, status_code=status.HTTP_201_CREATED)
def add_github_project(
    payload: GithubProjectRequest,
    user: Annotated[User, Depends(verified_user)],
    db: Annotated[Session, Depends(get_db)],
) -> GithubProjectResponse:
    try:
        snapshot = fetch_snapshot(str(payload.url))
    except ValueError as exc:
        raise HTTPException(status_code=status.HTTP_422_UNPROCESSABLE_CONTENT, detail=str(exc)) from exc
    existing = db.scalar(
        select(GithubProject).where(
            GithubProject.user_id == user.id,
            GithubProject.canonical_url == snapshot.canonical_url,
        )
    )
    if existing:
        project = existing
        db.query(GithubSuggestion).filter(GithubSuggestion.project_id == project.id).delete()
    else:
        project = GithubProject(user_id=user.id, **{key: value for key, value in {
            "canonical_url": snapshot.canonical_url, "owner": snapshot.owner, "repository": snapshot.repository,
            "description": snapshot.description, "default_branch": snapshot.default_branch, "stars": snapshot.stars,
            "language": snapshot.language, "topics": json.dumps(snapshot.topics), "readme_excerpt": snapshot.readme,
        }.items()})
        db.add(project)
        db.flush()
    for name, category, excerpt, confidence, level in suggest_github_evidence(snapshot):
        db.add(
            GithubSuggestion(
                project_id=project.id,
                canonical_skill=name,
                category=category,
                excerpt=excerpt,
                confidence=confidence,
                proposed_level=level,
            )
        )
    project.status = "awaiting_review"
    audit(db, "evidence.github_added", user_id=user.id, metadata={"project_id": str(project.id)})
    db.commit()
    db.refresh(project)
    suggestions = list(db.scalars(select(GithubSuggestion).where(GithubSuggestion.project_id == project.id)))
    return GithubProjectResponse(
        id=project.id, canonical_url=project.canonical_url, repository=project.repository,
        description=project.description, stars=project.stars, language=project.language,
        topics=json.loads(project.topics), status=project.status, suggestions=suggestions,
    )


@app.post("/api/v1/evidence/github/{project_id}/review", response_model=GithubProjectResponse)
def review_github_project(
    project_id: UUID,
    payload: EvidenceReviewRequest,
    user: Annotated[User, Depends(verified_user)],
    db: Annotated[Session, Depends(get_db)],
) -> GithubProjectResponse:
    project = db.scalar(select(GithubProject).where(GithubProject.id == project_id, GithubProject.user_id == user.id))
    if project is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="GitHub project not found")
    if project.status != "awaiting_review":
        raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail="GitHub evidence is not awaiting review")
    suggestions = list(db.scalars(select(GithubSuggestion).where(GithubSuggestion.project_id == project.id)))
    decisions = {decision.suggestion_id: decision.decision for decision in payload.decisions}
    if set(decisions) != {suggestion.id for suggestion in suggestions}:
        raise HTTPException(status_code=status.HTTP_422_UNPROCESSABLE_CONTENT, detail="Review every suggestion once")
    reviewed_at = datetime.now(UTC)
    for suggestion in suggestions:
        suggestion.review_status = decisions[suggestion.id]
        suggestion.reviewed_at = reviewed_at
        if decisions[suggestion.id] == "confirmed":
            skill_slug = slug_for_name(suggestion.canonical_skill)
            if skill_slug:
                db.add(CandidateSkillEvidence(
                    user_id=user.id, github_project_id=project.id, github_suggestion_id=suggestion.id,
                    skill_slug=skill_slug, evidence_level=suggestion.proposed_level, confidence=suggestion.confidence,
                    excerpt=suggestion.excerpt, locator=project.canonical_url, source_type="github",
                ))
    project.status = "reviewed"
    audit(db, "evidence.github_reviewed", user_id=user.id, metadata={"project_id": str(project.id)})
    db.commit()
    return GithubProjectResponse(
        id=project.id, canonical_url=project.canonical_url, repository=project.repository,
        description=project.description, stars=project.stars, language=project.language,
        topics=json.loads(project.topics), status=project.status, suggestions=suggestions,
    )


@app.get("/api/v1/evidence/fit", response_model=RoleFitResponse)
def evidence_fit(
    role_family: str,
    user: Annotated[User, Depends(verified_user)],
    db: Annotated[Session, Depends(get_db)],
) -> RoleFitResponse:
    requirements = ROLE_REQUIREMENTS.get(role_family)
    if requirements is None:
        raise HTTPException(status_code=status.HTTP_422_UNPROCESSABLE_CONTENT, detail="Unknown role family")
    evidence = {}
    for item in db.scalars(select(CandidateSkillEvidence).where(CandidateSkillEvidence.user_id == user.id)):
        current = evidence.get(item.skill_slug)
        if current is None or item.evidence_level * item.confidence > current.evidence_level * current.confidence:
            evidence[item.skill_slug] = item
    skills = {
        skill.slug: skill
        for skill in db.scalars(
            select(CanonicalSkill).where(CanonicalSkill.slug.in_(slug for slug, _, _ in requirements))
        )
    }
    total_weight = sum(weight for _, weight, _ in requirements)
    covered_weight = sum(
        weight for slug, weight, _ in requirements if slug in evidence and evidence[slug].evidence_level > 0
    )
    depth = sum(
        weight * (evidence[slug].evidence_level / 5) * evidence[slug].confidence * 100
        for slug, weight, _ in requirements if slug in evidence
    ) / total_weight
    coverage = covered_weight / total_weight * 100
    contributions = []
    for slug, weight, required in requirements:
        item = evidence.get(slug)
        level = item.evidence_level if item else 0
        normalized = round((level / 5) * (item.confidence if item else 0) * 100, 2)
        contributions.append({
            "skill_slug": slug, "skill_name": skills[slug].name if slug in skills else SKILLS[slug][0],
            "weight": weight, "required": required,
            "evidence_level": level, "normalized_score": normalized, "weighted_score": round(normalized * weight, 2),
        })
    score = coverage * 0.65 + depth * 0.35
    cap_applied = any(required and slug not in evidence for slug, _, required in requirements) and score > 59
    if cap_applied:
        score = 59
    return RoleFitResponse(
        role_family=role_family, score=round(score, 2), coverage=round(coverage, 2),
        evidence_depth=round(depth, 2), cap_applied=cap_applied, contributions=contributions,
    )


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
