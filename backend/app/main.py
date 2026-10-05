# ruff: noqa: E501
import hashlib
import json
import logging
import time
from collections import defaultdict
from datetime import UTC, datetime, timedelta
from pathlib import Path
from threading import Lock
from typing import Annotated
from urllib.error import HTTPError, URLError
from urllib.request import Request as UrlRequest
from urllib.request import urlopen
from uuid import UUID, uuid4

from fastapi import Cookie, Depends, FastAPI, Header, HTTPException, Request, Response, status
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse, PlainTextResponse
from sqlalchemy import delete, desc, func, select
from sqlalchemy.exc import IntegrityError
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
from .database import SessionLocal, get_db
from .github import fetch_snapshot, list_public_repositories, suggest_github_evidence
from .mailer import enqueue_email
from .market_ingestion import persist_market_postings
from .models import (
    AuditEvent,
    CandidateSkillEvidence,
    CanonicalSkill,
    CareerProfile,
    CareerTarget,
    CollectorRun,
    CollectorSource,
    DevelopmentPlanTask,
    DocumentExtraction,
    EmailOutbox,
    EvidenceSource,
    EvidenceSuggestion,
    EvidenceUpload,
    GithubProject,
    GithubSuggestion,
    JobAnalysis,
    JobChunk,
    JobPosting,
    JobPostingSkill,
    JobStatusEvent,
    OneTimeToken,
    ProcessingJob,
    RefreshSession,
    RetrievalJudgement,
    SavedJob,
    User,
)
from .rag import embed_query, index_job_postings, search_job_evidence
from .rag_eval import evaluate_retrieval
from .role_decoder import ROLE_LABELS, ROLE_SIGNAL_BONUSES, decode_role
from .schemas import (
    AuthResponse,
    CollectorRunResponse,
    CollectorSourceRequest,
    CollectorSourceResponse,
    DeleteAccountRequest,
    DevelopmentPlanGenerateRequest,
    DevelopmentPlanTaskResponse,
    DevelopmentPlanTaskUpdateRequest,
    DimensionScoreRequest,
    DimensionScoreResponse,
    EmailRequest,
    EvidenceCitation,
    EvidenceExplainRequest,
    EvidenceExplainResponse,
    EvidenceReviewRequest,
    EvidenceSearchRequest,
    EvidenceSearchResponse,
    ExtractionResponse,
    GithubProjectRequest,
    GithubProjectResponse,
    GithubRepositoryCandidateResponse,
    JobAnalysisDetailResponse,
    JobAnalysisSummaryResponse,
    JobStatusEventResponse,
    LoginRequest,
    MarketImportRequest,
    MarketQualityResponse,
    MarketSummaryResponse,
    ProcessingJobResponse,
    ProfileResponse,
    ProfileSetupRequest,
    RagEvaluationResponse,
    RagIndexRequest,
    RagIndexResponse,
    RegisterRequest,
    ResetPasswordRequest,
    RetrievalJudgementRequest,
    RetrievalJudgementResponse,
    RetrievalQualityResponse,
    RoleDecodeRequest,
    RoleDecodeResponse,
    RoleFamily,
    RoleFitResponse,
    SavedJobCreateRequest,
    SavedJobFromAnalysisRequest,
    SavedJobResponse,
    SavedJobUpdateRequest,
    SkillEvidenceResponse,
    SkillGraphResponse,
    TokenRequest,
    UploadInitiateRequest,
    UploadInitiateResponse,
    UploadResponse,
    UserResponse,
)
from .scoring import (
    EvidenceScoreInput,
    aggregate_evidence_strength,
    calculate_dimension_score,
    calculate_job_demand_score,
)
from .security_events import actor_fingerprint, audit, enforce_event_limit, enforce_login_limit
from .storage import delete_object, ensure_bucket, object_metadata, presigned_put
from .taxonomy import ROLE_BENCHMARK_SOURCES, ROLE_REQUIREMENTS, SKILLS, slug_for_name

settings = get_settings()
logger = logging.getLogger("career_signal.request")
app = FastAPI(title=settings.app_name, version="0.1.0")
_metrics_lock = Lock()
_request_counts: defaultdict[tuple[str, str, str], int] = defaultdict(int)
_request_latency_ms: defaultdict[tuple[str, str], float] = defaultdict(float)
_rate_limit_lock = Lock()
_rate_limit_buckets: defaultdict[tuple[str, str, int], int] = defaultdict(int)
_rate_limited_prefixes = {
    "/api/v1/role-decoder": (30, 60),
    "/api/v1/rag/search": (30, 60),
    "/api/v1/rag/explain": (10, 60),
    "/api/v1/evidence/github": (20, 60),
    "/api/v1/evidence/uploads": (20, 60),
}
app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.allowed_origins,
    allow_credentials=True,
    allow_methods=["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"],
    allow_headers=["Content-Type", "Authorization", "X-Ingestion-Key", "X-Requested-With"],
    expose_headers=["X-Request-ID"],
)


def aggregate_candidate_evidence(items: list[CandidateSkillEvidence]):
    grouped: defaultdict[str, list[EvidenceScoreInput]] = defaultdict(list)
    for item in items:
        source_id = item.github_project_id or item.upload_id or item.locator
        grouped[item.skill_slug].append(
            EvidenceScoreInput(
                evidence_level=item.evidence_level,
                confidence=item.confidence,
                excerpt=item.excerpt,
                locator=item.locator,
                source_type=item.source_type,
                source_reference=f"{item.source_type}:{source_id}",
            )
        )
    return {slug: aggregate_evidence_strength(records) for slug, records in grouped.items()}


@app.middleware("http")
async def request_context(request: Request, call_next):
    """Attach a correlation id to every response without logging personal payloads."""
    request_id = request.headers.get("X-Request-ID") or str(uuid4())
    started = time.perf_counter()
    if settings.environment == "production" and request.method not in {"OPTIONS", "GET"}:
        limit_config = next(
            (config for prefix, config in _rate_limited_prefixes.items() if request.url.path.startswith(prefix)),
            None,
        )
        if limit_config:
            limit, window = limit_config
            actor = request.client.host if request.client else "unknown"
            bucket = int(time.time() // window)
            key = (actor, request.url.path, bucket)
            with _rate_limit_lock:
                _rate_limit_buckets[key] += 1
                count = _rate_limit_buckets[key]
                if len(_rate_limit_buckets) > 5000:
                    _rate_limit_buckets.clear()
            if count > limit:
                return JSONResponse(
                    status_code=status.HTTP_429_TOO_MANY_REQUESTS,
                    content={"detail": "Too many requests. Please retry shortly."},
                    headers={"Retry-After": str(window)},
                )
    request.state.request_id = request_id
    response = None
    try:
        response = await call_next(request)
    except Exception:
        logger.exception(
            json.dumps({"event": "http.request.failed", "request_id": request_id, "method": request.method, "path": request.url.path})
        )
        raise
    finally:
        duration_ms = round((time.perf_counter() - started) * 1000, 2)
        route = getattr(request.scope.get("route"), "path", request.url.path)
        status_code = str(getattr(response, "status_code", 500))
        with _metrics_lock:
            _request_counts[(request.method, route, status_code)] += 1
            _request_latency_ms[(request.method, route)] += duration_ms
        logger.info(json.dumps({
            "event": "http.request",
            "request_id": request_id,
            "method": request.method,
            "path": request.url.path,
            "status": status_code,
            "duration_ms": duration_ms,
        }))
    response.headers["X-Request-ID"] = request_id
    return response


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
        f"Verify your CareerSignal email:\n\n{settings.frontend_url}/verify-email?token={token}\n\nThis link expires in 24 hours."
    )


def reset_message(token: str) -> str:
    return (
        f"Reset your CareerSignal password:\n\n{settings.frontend_url}/reset-password?token={token}\n\nThis link expires in 1 hour."
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
    enqueue_email(db, user.email, "Verify your CareerSignal email", verification_message(token))
    db.commit()
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
    enqueue_email(db, user.email, "Verify your CareerSignal email", verification_message(token))
    db.commit()
    return {"status": "sent"}


@app.post("/api/v1/auth/forgot-password", status_code=status.HTTP_202_ACCEPTED)
def forgot_password(
    payload: EmailRequest,
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
        enqueue_email(db, user.email, "Reset your CareerSignal password", reset_message(token))
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


@app.get("/metrics", include_in_schema=False, response_class=PlainTextResponse)
def metrics() -> str:
    """Expose low-cardinality Prometheus metrics for a reverse proxy or scraper."""
    with _metrics_lock:
        counts = dict(_request_counts)
        latency = dict(_request_latency_ms)
    lines = [
        "# HELP careersignal_http_requests_total Total HTTP requests handled by route.",
        "# TYPE careersignal_http_requests_total counter",
    ]
    for (method, route, status_code), count in sorted(counts.items()):
        labels = f'method="{method}",route="{route}",status="{status_code}"'
        lines.append(f"careersignal_http_requests_total{{{labels}}} {count}")
    lines.extend([
        "# HELP careersignal_http_request_duration_ms_sum Total request duration in milliseconds by route.",
        "# TYPE careersignal_http_request_duration_ms_sum counter",
    ])
    for (method, route), total in sorted(latency.items()):
        labels = f'method="{method}",route="{route}"'
        lines.append(f"careersignal_http_request_duration_ms_sum{{{labels}}} {total:.2f}")
    lines.extend([
        "# HELP careersignal_queue_depth Current durable work items by queue and status.",
        "# TYPE careersignal_queue_depth gauge",
    ])
    try:
        with SessionLocal() as db:
            queue_models = {
                "documents": (ProcessingJob, ("queued", "processing")),
                "collectors": (CollectorRun, ("queued", "processing")),
                "email": (EmailOutbox, ("queued", "sending")),
            }
            for queue_name, (model, statuses) in queue_models.items():
                for queue_status in statuses:
                    depth = db.scalar(select(func.count(model.id)).where(model.status == queue_status)) or 0
                    lines.append(
                        f'careersignal_queue_depth{{queue="{queue_name}",status="{queue_status}"}} {depth}'
                    )
            lines.extend([
                "# HELP careersignal_failures_24h Durable work items that failed in the last 24 hours.",
                "# TYPE careersignal_failures_24h gauge",
            ])
            recent_failure_cutoff = datetime.now(UTC) - timedelta(hours=24)
            failure_models = {
                "documents": (ProcessingJob, ProcessingJob.updated_at),
                "collectors": (CollectorRun, CollectorRun.completed_at),
                "email": (EmailOutbox, EmailOutbox.updated_at),
            }
            for queue_name, (model, timestamp) in failure_models.items():
                failed_count = db.scalar(select(func.count(model.id)).where(
                    model.status == "failed",
                    timestamp >= recent_failure_cutoff,
                )) or 0
                lines.append(f'careersignal_failures_24h{{queue="{queue_name}"}} {failed_count}')
            overdue_sources = db.scalar(
                select(func.count(CollectorSource.id)).where(
                    CollectorSource.enabled.is_(True),
                    CollectorSource.next_run_at < datetime.now(UTC) - timedelta(minutes=5),
                )
            ) or 0
            lines.extend([
                "# HELP careersignal_collector_sources_overdue Enabled sources overdue by more than five minutes.",
                "# TYPE careersignal_collector_sources_overdue gauge",
                f"careersignal_collector_sources_overdue {overdue_sources}",
            ])
            analytics_since = datetime.now(UTC) - timedelta(days=30)
            active_users = db.scalar(
                select(func.count(func.distinct(AuditEvent.user_id))).where(
                    AuditEvent.user_id.is_not(None),
                    AuditEvent.created_at >= analytics_since,
                )
            ) or 0
            lines.extend([
                "# HELP careersignal_active_users_30d Users with a product event in the last 30 days.",
                "# TYPE careersignal_active_users_30d gauge",
                f"careersignal_active_users_30d {active_users}",
                "# HELP careersignal_product_events_30d Privacy-safe product events in the last 30 days.",
                "# TYPE careersignal_product_events_30d gauge",
            ])
            product_events = (
                "role_decoder.completed",
                "evidence.github_reviewed",
                "job.saved",
                "job.saved_from_analysis",
                "job.updated",
                "plan.generated",
                "plan.task_updated",
            )
            event_counts = dict(db.execute(
                select(AuditEvent.event_type, func.count(AuditEvent.id))
                .where(AuditEvent.event_type.in_(product_events), AuditEvent.created_at >= analytics_since)
                .group_by(AuditEvent.event_type)
            ).all())
            for event_type in product_events:
                lines.append(
                    f'careersignal_product_events_30d{{event="{event_type}"}} {event_counts.get(event_type, 0)}'
                )
    except Exception:
        logger.exception("Operational database metrics could not be collected")
        lines.extend([
            "# HELP careersignal_operational_metrics_available Whether database-backed operational metrics are available.",
            "# TYPE careersignal_operational_metrics_available gauge",
            "careersignal_operational_metrics_available 0",
        ])
    else:
        lines.extend([
            "# HELP careersignal_operational_metrics_available Whether database-backed operational metrics are available.",
            "# TYPE careersignal_operational_metrics_available gauge",
            "careersignal_operational_metrics_available 1",
        ])
    return "\n".join(lines) + "\n"


@app.get("/ready")
def readiness(db: Annotated[Session, Depends(get_db)]) -> dict[str, str]:
    """Readiness is deliberately separate from liveness for container orchestration."""
    try:
        db.execute(select(func.count()).select_from(User)).scalar_one()
    except Exception as exc:
        raise HTTPException(status_code=status.HTTP_503_SERVICE_UNAVAILABLE, detail="Database is not ready") from exc
    return {"status": "ready", "service": "career-signal-api"}


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
def role_decoder(
    payload: RoleDecodeRequest,
    user: Annotated[User, Depends(verified_user)],
    db: Annotated[Session, Depends(get_db)],
) -> RoleDecodeResponse:
    decoded = decode_role(payload.title, payload.description)
    demanded_slugs = {signal.slug for signal in decoded.skill_signals}
    evidence = aggregate_candidate_evidence(list(db.scalars(
        select(CandidateSkillEvidence).where(
            CandidateSkillEvidence.user_id == user.id,
            CandidateSkillEvidence.skill_slug.in_(demanded_slugs),
        )
    )))
    skill_demands = []
    for signal in decoded.skill_signals:
        summary = evidence.get(signal.slug) or aggregate_evidence_strength([])
        strength = summary.strength
        demand = calculate_job_demand_score(signal.mention_count, signal.importance, signal.in_title)
        skill_demands.append({
            "slug": signal.slug,
            "name": signal.name,
            "required": signal.importance == "essential",
            "importance": signal.importance,
            "role_families": [
                role
                for role, requirements in ROLE_REQUIREMENTS.items()
                if any(slug == signal.slug for slug, _, _ in requirements)
                or signal.slug in ROLE_SIGNAL_BONUSES.get(role, {})
            ],
            "mention_count": signal.mention_count,
            "demand_score": demand.score,
            "explicit_mention": demand.explicit_mention,
            "repetition_signal": demand.repetition_signal,
            "requirement_signal": demand.requirement_signal,
            "title_signal": demand.title_signal,
            "evidence_level": summary.evidence_level,
            "evidence_score": strength.score,
            "evidence_confidence": summary.confidence,
            "source_count": summary.source_count,
            "source_type_count": summary.source_type_count,
            "evidence_base_score": strength.base_score,
            "confidence_adjustment": strength.confidence_adjustment,
            "specificity_bonus": strength.specificity_bonus,
            "verification_bonus": strength.verification_bonus,
            "outcome_bonus": strength.outcome_bonus,
            "corroboration_bonus": strength.corroboration_bonus,
            "diversity_bonus": strength.diversity_bonus,
            "score_factors": list(summary.score_factors),
        })
    result = RoleDecodeResponse(
        role_family=decoded.role_family,
        role_label=decoded.role_label,
        confidence=decoded.confidence,
        seniority=decoded.seniority,
        scope_status=decoded.scope_status,
        taxonomy_coverage=decoded.taxonomy_coverage,
        matched_skills=[
            {"slug": slug, "name": name, "mention_count": count}
            for slug, name, count in decoded.matched_skills
        ],
        skill_demands=skill_demands,
        role_matches=[
            {"role_family": role, "role_label": ROLE_LABELS[role], "match_score": score}
            for role, score in decoded.role_matches
        ],
        unmapped_skills=decoded.unmapped_skills,
        eligibility_requirements=[
            {
                "category": requirement.category,
                "label": requirement.label,
                "importance": requirement.importance,
                "excerpt": requirement.excerpt,
            }
            for requirement in decoded.eligibility_requirements
        ],
        alternatives=[
            {"role_family": role, "role_label": ROLE_LABELS[role], "score_share": share}
            for role, share in decoded.alternatives
        ],
    )
    analysis = JobAnalysis(
        user_id=user.id,
        title=payload.title.strip(),
        description=payload.description,
        role_family=result.role_family,
        scope_status=result.scope_status,
        confidence=result.confidence,
        result_json="{}",
    )
    db.add(analysis)
    db.flush()
    result.analysis_id = analysis.id
    analysis.result_json = json.dumps(result.model_dump(mode="json"))
    audit(db, "role_decoder.completed", user_id=user.id, metadata={"role_family": result.role_family})
    db.commit()
    return result


def require_ingestion_key(ingestion_key: str | None) -> None:
    if ingestion_key != settings.ingestion_api_key:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Invalid ingestion credential")


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


@app.post("/api/v1/market/collectors/{source_id}/run", response_model=CollectorRunResponse, status_code=status.HTTP_202_ACCEPTED)
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
    active = db.scalar(
        select(CollectorRun).where(
            CollectorRun.collector_source_id == source.id,
            CollectorRun.status.in_(["queued", "processing"]),
        )
    )
    if active is not None:
        return active
    now = datetime.now(UTC)
    if source.last_enqueued_at is not None:
        earliest = source.last_enqueued_at + timedelta(seconds=source.minimum_interval_seconds)
        if earliest > now:
            retry_after = max(1, int((earliest - now).total_seconds()))
            raise HTTPException(
                status_code=status.HTTP_429_TOO_MANY_REQUESTS,
                detail=f"This source can be queued again in {retry_after} seconds",
                headers={"Retry-After": str(retry_after)},
            )
    run = CollectorRun(collector_source_id=source.id, status="queued")
    db.add(run)
    source.last_enqueued_at = now
    source.next_run_at = now + timedelta(minutes=source.refresh_interval_minutes)
    db.commit()
    db.refresh(run)
    return run


@app.get("/api/v1/market/summary", response_model=MarketSummaryResponse)
def market_summary(
    user: Annotated[User, Depends(verified_user)],
    db: Annotated[Session, Depends(get_db)],
) -> MarketSummaryResponse:
    def normalise_location(raw_location: str) -> str:
        location = raw_location.strip()
        lowered = location.casefold()
        if "remote" in lowered and any(term in lowered for term in ("nz", "new zealand", "aotearoa")):
            return "Remote / New Zealand"
        for city in (
            "Auckland", "Wellington", "Christchurch", "Hamilton", "Tauranga", "Dunedin",
            "Palmerston North", "Napier", "Nelson", "Queenstown", "Warkworth", "Mahia", "Waikato",
        ):
            if city.casefold() in lowered:
                return city
        for suffix in (", new zealand", ", nz"):
            if lowered.endswith(suffix):
                return location[: -len(suffix)].strip()
        return location

    roles = db.execute(
        select(JobPosting.role_family, func.count(JobPosting.id))
        .group_by(JobPosting.role_family)
        .order_by(desc(func.count(JobPosting.id)))
    ).all()
    raw_locations = db.execute(
        select(JobPosting.location, func.count(JobPosting.id))
        .group_by(JobPosting.location)
        .order_by(desc(func.count(JobPosting.id)))
    ).all()
    normalized_locations: dict[str, int] = {}
    location_labels: dict[str, str] = {}
    for raw_location, count in raw_locations:
        location = normalise_location(raw_location)
        key = location.casefold()
        location_labels.setdefault(key, location)
        normalized_locations[key] = normalized_locations.get(key, 0) + count
    locations = sorted(
        (
            {"location": location_labels[key], "count": count}
            for key, count in normalized_locations.items()
        ),
        key=lambda item: (-item["count"], item["location"]),
    )
    raw_role_locations = db.execute(
        select(JobPosting.role_family, JobPosting.location, func.count(JobPosting.id))
        .group_by(JobPosting.role_family, JobPosting.location)
    ).all()
    normalized_role_locations: dict[tuple[str, str], int] = {}
    role_location_labels: dict[tuple[str, str], str] = {}
    for role, raw_location, count in raw_role_locations:
        location = normalise_location(raw_location)
        key = (role, location.casefold())
        role_location_labels.setdefault(key, location)
        normalized_role_locations[key] = normalized_role_locations.get(key, 0) + count
    role_locations = sorted(
        (
            {
                "role_family": role,
                "location": role_location_labels[(role, location_key)],
                "count": count,
            }
            for (role, location_key), count in normalized_role_locations.items()
        ),
        key=lambda item: (item["role_family"], -item["count"], item["location"]),
    )
    seniority = db.execute(
        select(JobPosting.seniority, func.count(JobPosting.id))
        .group_by(JobPosting.seniority)
        .order_by(desc(func.count(JobPosting.id)))
    ).all()
    role_seniority = db.execute(
        select(JobPosting.role_family, JobPosting.seniority, func.count(JobPosting.id))
        .group_by(JobPosting.role_family, JobPosting.seniority)
        .order_by(JobPosting.role_family, desc(func.count(JobPosting.id)))
    ).all()
    skills = db.execute(
        select(JobPostingSkill.skill_slug, func.count(JobPostingSkill.posting_id))
        .group_by(JobPostingSkill.skill_slug)
        .order_by(desc(func.count(JobPostingSkill.posting_id)))
        .limit(15)
    ).all()
    role_skills = db.execute(
        select(
            JobPosting.role_family,
            JobPostingSkill.skill_slug,
            func.count(JobPostingSkill.posting_id),
        )
        .join(JobPosting, JobPosting.id == JobPostingSkill.posting_id)
        .group_by(JobPosting.role_family, JobPostingSkill.skill_slug)
        .order_by(JobPosting.role_family, desc(func.count(JobPostingSkill.posting_id)))
    ).all()
    return MarketSummaryResponse(
        posting_count=db.scalar(select(func.count(JobPosting.id))) or 0,
        source_count=db.scalar(select(func.count(func.distinct(JobPosting.source_id)))) or 0,
        latest_retrieved_at=db.scalar(select(func.max(JobPosting.retrieved_at))),
        roles=[{"role_family": role, "count": count} for role, count in roles],
        seniority=[{"seniority": level, "count": count} for level, count in seniority],
        role_seniority=[
            {"role_family": role, "seniority": level, "count": count}
            for role, level, count in role_seniority
        ],
        locations=locations,
        top_skills=[{"skill_slug": slug, "skill_name": SKILLS[slug][0], "count": count} for slug, count in skills],
        role_skills=[
            {
                "role_family": role,
                "skill_slug": slug,
                "skill_name": SKILLS[slug][0],
                "count": count,
            }
            for role, slug, count in role_skills
            if slug in SKILLS
        ],
        role_locations=role_locations,
    )


@app.get("/api/v1/market/quality", response_model=MarketQualityResponse)
def market_quality(
    user: Annotated[User, Depends(verified_user)],
    db: Annotated[Session, Depends(get_db)],
) -> MarketQualityResponse:
    def normalise_location(raw_location: str) -> str:
        value = raw_location.strip()
        lowered = value.casefold()
        if "remote" in lowered and any(term in lowered for term in ("nz", "new zealand", "aotearoa")):
            return "Remote / New Zealand"
        for city in ("Auckland", "Wellington", "Christchurch", "Hamilton", "Tauranga", "Dunedin"):
            if city.casefold() in lowered:
                return city
        if "new zealand" in lowered or "aotearoa" in lowered or lowered.endswith(", nz") or lowered == "nz":
            return "New Zealand"
        return value or "Unspecified"

    posting_count = db.scalar(select(func.count(JobPosting.id))) or 0
    missing_dates = db.scalar(
        select(func.count(JobPosting.id)).where(JobPosting.published_at.is_(None))
    ) or 0
    stale_before = datetime.now(UTC) - timedelta(days=90)
    stale_count = db.scalar(
        select(func.count(JobPosting.id)).where(JobPosting.published_at.is_not(None), JobPosting.published_at < stale_before)
    ) or 0
    graduate_junior_count = db.scalar(
        select(func.count(JobPosting.id)).where(JobPosting.seniority.in_(["graduate", "junior"]))
    ) or 0
    raw_locations = list(db.scalars(select(JobPosting.location).distinct()))
    normalised_location_count = len({normalise_location(value).casefold() for value in raw_locations})
    active_source_count = db.scalar(select(func.count(func.distinct(JobPosting.source_id)))) or 0
    latest_retrieved_at = db.scalar(select(func.max(JobPosting.retrieved_at)))
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
                "next_run_at": source.next_run_at.isoformat(),
                "refresh_interval_minutes": source.refresh_interval_minutes,
                "accepted_count": latest.accepted_count if latest else 0,
                "rejected_count": latest.rejected_count if latest else 0,
            }
        )
    warnings: list[str] = []
    if posting_count < 100:
        warnings.append("Small sample: do not interpret counts as a complete New Zealand market total.")
    if graduate_junior_count < 10:
        warnings.append("Graduate and junior coverage is limited; role comparisons may be unstable for early-career users.")
    if stale_count:
        warnings.append(f"{stale_count} postings are older than 90 days and should be refreshed or excluded.")
    if active_source_count < 5:
        warnings.append("The sample is concentrated in a small number of employers.")
    return MarketQualityResponse(
        posting_count=posting_count,
        active_source_count=active_source_count,
        latest_retrieved_at=latest_retrieved_at,
        graduate_junior_count=graduate_junior_count,
        normalised_location_count=normalised_location_count,
        missing_publication_date_percent=round((missing_dates / posting_count * 100) if posting_count else 0, 1),
        low_confidence_count=db.scalar(
            select(func.count(JobPosting.id)).where(JobPosting.classification_confidence < 0.5)
        )
        or 0,
        stale_posting_count=stale_count,
        duplicate_url_count=0,
        collector_completed_count=db.scalar(
            select(func.count(CollectorRun.id)).where(CollectorRun.status == "completed")
        )
        or 0,
        collector_failed_count=db.scalar(
            select(func.count(CollectorRun.id)).where(CollectorRun.status == "failed")
        )
        or 0,
        sample_warnings=warnings,
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
            citation_id=str(row["id"]),
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


@app.post("/api/v1/rag/explain", response_model=EvidenceExplainResponse)
def explain_market_evidence(
    payload: EvidenceExplainRequest,
    user: Annotated[User, Depends(verified_user)],
    db: Annotated[Session, Depends(get_db)],
) -> EvidenceExplainResponse:
    settings = get_settings()
    if not settings.openai_api_key:
        raise HTTPException(status_code=status.HTTP_503_SERVICE_UNAVAILABLE, detail="AI explanations are not configured")
    search = search_market_evidence(payload, user, db)
    if not search.citations:
        raise HTTPException(status_code=status.HTTP_422_UNPROCESSABLE_ENTITY, detail="No market evidence matched this question")
    evidence = "\n\n".join(
        f"[{item.citation_id}] {item.title} at {item.company} ({item.location})\n{item.excerpt}\nSource: {item.source_url}"
        for item in search.citations
    )
    request_body = json.dumps({
        "model": settings.openai_model,
        "max_output_tokens": settings.openai_max_output_tokens,
        "text": {
            "format": {
                "type": "json_schema",
                "name": "career_signal_market_summary",
                "strict": True,
                "schema": {
                    "type": "object",
                    "additionalProperties": False,
                    "properties": {"answer": {"type": "string"}},
                    "required": ["answer"],
                },
            }
        },
        "input": [
            {"role": "system", "content": [{"type": "input_text", "text": "You are CareerSignal's evidence analyst. Answer only from the supplied job evidence. Do not invent market statistics. Cite claims with bracketed citation IDs. Be concise and practical for a New Zealand technology job seeker."}]},
            {"role": "user", "content": [{"type": "input_text", "text": f"Audience: {payload.audience}\nQuestion: {payload.query}\nEvidence:\n{evidence}"}]},
        ],
    }).encode()
    request = UrlRequest("https://api.openai.com/v1/responses", data=request_body, headers={"Authorization": f"Bearer {settings.openai_api_key}", "Content-Type": "application/json"}, method="POST")
    try:
        with urlopen(request, timeout=45) as response:
            result = json.load(response)
    except (HTTPError, URLError, TimeoutError) as exc:
        raise HTTPException(status_code=status.HTTP_502_BAD_GATEWAY, detail="AI explanation request failed") from exc
    answer = result.get("output_text")
    if answer:
        try:
            parsed_answer = json.loads(answer)
            answer = parsed_answer.get("answer", answer)
        except (TypeError, ValueError):
            pass
    if not answer:
        answer = "\n".join(
            part.get("text", "")
            for item in result.get("output", [])
            for part in item.get("content", [])
            if part.get("type") in {"output_text", "text"}
        ).strip()
    if not answer:
        raise HTTPException(status_code=status.HTTP_502_BAD_GATEWAY, detail="AI explanation returned no text")
    return EvidenceExplainResponse(query=payload.query, answer=answer, citations=search.citations, model=result.get("model", settings.openai_model))


@app.post("/api/v1/rag/judgements", response_model=RetrievalJudgementResponse, status_code=status.HTTP_201_CREATED)
def create_retrieval_judgement(
    payload: RetrievalJudgementRequest,
    user: Annotated[User, Depends(verified_user)],
    db: Annotated[Session, Depends(get_db)],
) -> RetrievalJudgement:
    chunk = db.get(JobChunk, payload.citation_id)
    if chunk is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Citation is no longer available")
    query_hash = hashlib.sha256(payload.query.strip().casefold().encode()).hexdigest()
    judgement = db.scalar(
        select(RetrievalJudgement).where(
            RetrievalJudgement.user_id == user.id,
            RetrievalJudgement.query_hash == query_hash,
            RetrievalJudgement.chunk_id == chunk.id,
        )
    )
    if judgement is None:
        judgement = RetrievalJudgement(user_id=user.id, chunk_id=chunk.id, query_hash=query_hash)
        db.add(judgement)
    judgement.query_text = payload.query.strip()
    judgement.role_family = payload.role_family
    judgement.location = payload.location
    judgement.seniority = payload.seniority
    judgement.result_rank = payload.result_rank
    judgement.relevant = payload.relevant
    judgement.notes = payload.notes
    db.commit()
    db.refresh(judgement)
    return judgement


@app.get("/api/v1/rag/judgements/quality", response_model=RetrievalQualityResponse)
def retrieval_judgement_quality(
    user: Annotated[User, Depends(verified_user)],
    db: Annotated[Session, Depends(get_db)],
) -> RetrievalQualityResponse:
    judgements = list(
        db.scalars(
            select(RetrievalJudgement)
            .where(RetrievalJudgement.user_id == user.id)
            .order_by(RetrievalJudgement.created_at.desc())
        )
    )
    relevant = [item for item in judgements if item.relevant]
    grouped: dict[str, list[RetrievalJudgement]] = {}
    for item in judgements:
        grouped.setdefault(item.role_family or "unfiltered", []).append(item)
    return RetrievalQualityResponse(
        labelled_count=len(judgements),
        relevant_count=len(relevant),
        relevance_rate=round(len(relevant) / len(judgements), 4) if judgements else None,
        relevant_mean_rank=round(sum(item.result_rank for item in relevant) / len(relevant), 2) if relevant else None,
        by_role_family=[
            {
                "role_family": role,
                "labelled_count": len(items),
                "relevant_count": sum(item.relevant for item in items),
                "relevance_rate": round(sum(item.relevant for item in items) / len(items), 4),
            }
            for role, items in sorted(grouped.items())
        ],
    )


@app.post("/api/v1/rag/evaluate", response_model=RagEvaluationResponse)
def evaluate_market_retrieval(
    db: Annotated[Session, Depends(get_db)],
    ingestion_key: Annotated[str | None, Header(alias="X-Ingestion-Key")] = None,
) -> RagEvaluationResponse:
    require_ingestion_key(ingestion_key)
    return RagEvaluationResponse(**evaluate_retrieval(db))


def profile_response(profile: CareerProfile) -> ProfileResponse:
    primary = next((target for target in profile.targets if target.is_primary), None)
    if primary is None:
        raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail="Profile has no active career target")
    return ProfileResponse(
        id=profile.id,
        location=profile.location,
        seniority=profile.seniority,
        role_family=primary.role_family,
        evidence_sources=profile.evidence_sources,
        updated_at=profile.updated_at,
    )


def ensure_canonical_skills(db: Session, skill_slugs: set[str]) -> None:
    if not skill_slugs:
        return
    available = set(db.scalars(select(CanonicalSkill.slug).where(CanonicalSkill.slug.in_(skill_slugs))))
    missing = sorted(skill_slugs - available)
    if missing:
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail="The skill catalogue is being updated. Please retry in a moment.",
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


def saved_job_response(db: Session, job: SavedJob) -> SavedJobResponse:
    """Add a current, evidence-based preparation summary without storing another score."""
    skill_demands: list[dict] = []
    if job.analysis_id is not None:
        analysis = db.get(JobAnalysis, job.analysis_id)
        if analysis is not None:
            try:
                result = RoleDecodeResponse.model_validate(json.loads(analysis.result_json))
                skill_demands = [item.model_dump() for item in result.skill_demands]
            except (TypeError, ValueError):
                skill_demands = []
    slugs = {str(item["slug"]) for item in skill_demands}
    evidence = aggregate_candidate_evidence(list(db.scalars(
        select(CandidateSkillEvidence).where(
            CandidateSkillEvidence.user_id == job.user_id,
            CandidateSkillEvidence.skill_slug.in_(slugs),
        )
    ))) if slugs else {}
    evidenced_count = sum(1 for slug in slugs if evidence.get(slug) and evidence[slug].evidence_level > 0)
    ranked_gaps = sorted(
        (
            (
                not bool(item.get("required")),
                (evidence.get(str(item["slug"])) or aggregate_evidence_strength([])).strength.score,
                -float(item.get("demand_score", 0)),
                str(item["name"]),
            )
            for item in skill_demands
            if not evidence.get(str(item["slug"])) or evidence[str(item["slug"])].evidence_level == 0
        ),
        key=lambda item: (item[0], item[1], item[2], item[3]),
    )
    return SavedJobResponse.model_validate(job).model_copy(update={
        "evidenced_skill_count": evidenced_count,
        "skill_count": len(slugs),
        "top_gaps": [item[3] for item in ranked_gaps[:3]],
    })


@app.get("/api/v1/jobs", response_model=list[SavedJobResponse])
def list_saved_jobs(
    user: Annotated[User, Depends(verified_user)], db: Annotated[Session, Depends(get_db)]
) -> list[SavedJobResponse]:
    jobs = list(
        db.scalars(
            select(SavedJob)
            .where(SavedJob.user_id == user.id)
            .order_by(SavedJob.updated_at.desc(), SavedJob.created_at.desc())
        )
    )
    return [saved_job_response(db, job) for job in jobs]


@app.post("/api/v1/jobs", response_model=SavedJobResponse, status_code=status.HTTP_201_CREATED)
def save_job(
    payload: SavedJobCreateRequest,
    user: Annotated[User, Depends(verified_user)],
    db: Annotated[Session, Depends(get_db)],
) -> SavedJobResponse:
    if payload.source_url is None:
        raise HTTPException(status_code=status.HTTP_422_UNPROCESSABLE_CONTENT, detail="A source URL or analysis is required")
    source_url = str(payload.source_url).rstrip("/")
    analysis_id = payload.analysis_id
    description = payload.description
    role_family = payload.role_family
    existing = db.scalar(select(SavedJob).where(SavedJob.user_id == user.id, SavedJob.source_url == source_url))
    posting = db.scalar(select(JobPosting).where(JobPosting.source_url == source_url))
    if analysis_id is None and posting is not None and (existing is None or existing.analysis_id is None):
        decoded = role_decoder(
            RoleDecodeRequest(title=posting.title, description=posting.description),
            user,
            db,
        )
        analysis_id = decoded.analysis_id
        description = posting.description
        role_family = decoded.role_family
    if existing is not None:
        previous_status = existing.status
        if analysis_id is not None:
            analysis = db.scalar(select(JobAnalysis).where(JobAnalysis.id == analysis_id, JobAnalysis.user_id == user.id))
            if analysis is None:
                raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Role analysis not found")
            existing.analysis_id = analysis.id
        existing.title = payload.title
        existing.company = payload.company
        existing.location = payload.location
        existing.role_family = role_family
        existing.description = description
        existing.status = "saved" if existing.status == "archived" else existing.status
        if existing.status != previous_status:
            db.add(JobStatusEvent(saved_job_id=existing.id, from_status=previous_status, to_status=existing.status))
        db.commit()
        db.refresh(existing)
        return saved_job_response(db, existing)
    if analysis_id is not None:
        analysis = db.scalar(select(JobAnalysis).where(JobAnalysis.id == analysis_id, JobAnalysis.user_id == user.id))
        if analysis is None:
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Role analysis not found")
    job = SavedJob(
        user_id=user.id,
        analysis_id=analysis_id,
        source_url=source_url,
        title=payload.title,
        company=payload.company,
        location=payload.location,
        role_family=role_family,
        description=description,
    )
    db.add(job)
    db.flush()
    db.add(JobStatusEvent(saved_job_id=job.id, from_status=None, to_status=job.status))
    audit(db, "job.saved", user_id=user.id, metadata={"source_url": source_url})
    try:
        db.commit()
    except IntegrityError as exc:
        db.rollback()
        raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail="This job is already saved") from exc
    db.refresh(job)
    return saved_job_response(db, job)


@app.patch("/api/v1/jobs/{job_id}", response_model=SavedJobResponse)
def update_saved_job(
    job_id: UUID,
    payload: SavedJobUpdateRequest,
    user: Annotated[User, Depends(verified_user)],
    db: Annotated[Session, Depends(get_db)],
) -> SavedJobResponse:
    job = db.scalar(select(SavedJob).where(SavedJob.id == job_id, SavedJob.user_id == user.id))
    if job is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Saved job not found")
    if payload.status is not None:
        previous_status = job.status
        job.status = payload.status
        if previous_status != job.status:
            db.add(JobStatusEvent(saved_job_id=job.id, from_status=previous_status, to_status=job.status))
    if payload.notes is not None:
        job.notes = payload.notes
    audit(db, "job.updated", user_id=user.id, metadata={"job_id": str(job.id), "status": job.status})
    db.commit()
    db.refresh(job)
    return saved_job_response(db, job)


@app.post("/api/v1/jobs/{job_id}/analysis", response_model=SavedJobResponse)
def ensure_saved_job_analysis(
    job_id: UUID,
    user: Annotated[User, Depends(verified_user)],
    db: Annotated[Session, Depends(get_db)],
) -> SavedJobResponse:
    """Create the comparison record for a saved vacancy that predates analysis persistence."""
    job = db.scalar(select(SavedJob).where(SavedJob.id == job_id, SavedJob.user_id == user.id))
    if job is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Saved job not found")
    if job.analysis_id is not None:
        return saved_job_response(db, job)
    if not job.description or len(job.description.strip()) < 40:
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_CONTENT,
            detail="This saved job does not contain enough advertisement text to compare",
        )
    decoded = role_decoder(
        RoleDecodeRequest(title=job.title, description=job.description),
        user,
        db,
    )
    job.analysis_id = decoded.analysis_id
    job.role_family = decoded.role_family
    db.commit()
    db.refresh(job)
    return saved_job_response(db, job)


@app.post("/api/v1/jobs/from-analysis/{analysis_id}", response_model=SavedJobResponse, status_code=status.HTTP_201_CREATED)
def save_role_analysis_as_job(
    analysis_id: UUID,
    payload: SavedJobFromAnalysisRequest,
    user: Annotated[User, Depends(verified_user)],
    db: Annotated[Session, Depends(get_db)],
) -> SavedJobResponse:
    analysis = db.scalar(select(JobAnalysis).where(JobAnalysis.id == analysis_id, JobAnalysis.user_id == user.id))
    if analysis is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Role analysis not found")
    source_url = f"https://careersignal.local/analysis/{analysis.id}"
    existing = db.scalar(select(SavedJob).where(SavedJob.user_id == user.id, SavedJob.source_url == source_url))
    if existing is not None:
        if payload.notes is not None:
            existing.notes = payload.notes
        db.refresh(existing)
        return saved_job_response(db, existing)
    job = SavedJob(
        user_id=user.id,
        analysis_id=analysis.id,
        source_url=source_url,
        title=analysis.title or "Untitled role analysis",
        company=payload.company,
        location=payload.location,
        role_family=analysis.role_family,
        description=analysis.description,
        notes=payload.notes,
    )
    db.add(job)
    db.flush()
    db.add(JobStatusEvent(saved_job_id=job.id, from_status=None, to_status=job.status))
    audit(db, "job.saved_from_analysis", user_id=user.id, metadata={"job_id": str(job.id), "analysis_id": str(analysis.id)})
    db.commit()
    db.refresh(job)
    return saved_job_response(db, job)


@app.delete("/api/v1/jobs/{job_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_saved_job(
    job_id: UUID,
    user: Annotated[User, Depends(verified_user)],
    db: Annotated[Session, Depends(get_db)],
) -> None:
    job = db.scalar(select(SavedJob).where(SavedJob.id == job_id, SavedJob.user_id == user.id))
    if job is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Saved job not found")
    db.delete(job)
    audit(db, "job.deleted", user_id=user.id, metadata={"job_id": str(job.id)})
    db.commit()


@app.get("/api/v1/jobs/{job_id}/history", response_model=list[JobStatusEventResponse])
def saved_job_history(
    job_id: UUID,
    user: Annotated[User, Depends(verified_user)],
    db: Annotated[Session, Depends(get_db)],
) -> list[JobStatusEvent]:
    job_exists = db.scalar(select(SavedJob.id).where(SavedJob.id == job_id, SavedJob.user_id == user.id))
    if job_exists is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Saved job not found")
    return list(
        db.scalars(
            select(JobStatusEvent)
            .where(JobStatusEvent.saved_job_id == job_id)
            .order_by(JobStatusEvent.changed_at.asc())
        )
    )


def development_plan_priorities(
    db: Session,
    user_id: UUID,
    role_family: str,
    saved_job: SavedJob | None = None,
) -> list[tuple[str, str]]:
    requirements = ROLE_REQUIREMENTS.get(role_family)
    if requirements is None:
        raise HTTPException(status_code=status.HTTP_422_UNPROCESSABLE_CONTENT, detail="Unknown role family")
    evidence = aggregate_candidate_evidence(list(
        db.scalars(select(CandidateSkillEvidence).where(CandidateSkillEvidence.user_id == user_id))
    ))
    if saved_job is not None and saved_job.analysis_id is not None:
        analysis = db.scalar(select(JobAnalysis).where(
            JobAnalysis.id == saved_job.analysis_id,
            JobAnalysis.user_id == user_id,
        ))
        if analysis is not None:
            try:
                result = RoleDecodeResponse.model_validate(json.loads(analysis.result_json))
                ranked_job_skills = sorted(
                    result.skill_demands,
                    key=lambda item: (
                        not item.required,
                        (evidence.get(item.slug) or aggregate_evidence_strength([])).strength.score,
                        -item.demand_score,
                        item.name,
                    ),
                )
                if ranked_job_skills:
                    return [(item.slug, item.name) for item in ranked_job_skills[:3]]
            except (TypeError, ValueError):
                pass
    ranked: list[tuple[bool, float, float, str, str]] = []
    for slug, weight, required in requirements:
        summary = evidence.get(slug) or aggregate_evidence_strength([])
        ranked.append((required, summary.strength.score, weight, slug, SKILLS[slug][0]))
    ranked.sort(key=lambda item: (-int(item[0]), item[1], -item[2], item[4]))
    return [(slug, name) for _, _, _, slug, name in ranked[:3]]


@app.get("/api/v1/plan", response_model=list[DevelopmentPlanTaskResponse])
def get_development_plan(
    role_family: str,
    user: Annotated[User, Depends(verified_user)],
    db: Annotated[Session, Depends(get_db)],
) -> list[DevelopmentPlanTask]:
    if role_family not in ROLE_REQUIREMENTS:
        raise HTTPException(status_code=status.HTTP_422_UNPROCESSABLE_CONTENT, detail="Unknown role family")
    return list(
        db.scalars(
            select(DevelopmentPlanTask)
            .where(
                DevelopmentPlanTask.user_id == user.id,
                DevelopmentPlanTask.role_family == role_family,
            )
            .order_by(DevelopmentPlanTask.position)
        )
    )


@app.post("/api/v1/plan/generate", response_model=list[DevelopmentPlanTaskResponse])
def generate_development_plan(
    payload: DevelopmentPlanGenerateRequest,
    user: Annotated[User, Depends(verified_user)],
    db: Annotated[Session, Depends(get_db)],
) -> list[DevelopmentPlanTask]:
    saved_job = None
    if payload.saved_job_id is not None:
        saved_job = db.scalar(select(SavedJob).where(
            SavedJob.id == payload.saved_job_id,
            SavedJob.user_id == user.id,
        ))
        if saved_job is None:
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Saved job not found")
        if saved_job.analysis_id is None:
            raise HTTPException(
                status_code=status.HTTP_422_UNPROCESSABLE_CONTENT,
                detail="Compare this role before creating a job-specific plan",
            )
        if saved_job.role_family and saved_job.role_family != payload.role_family:
            raise HTTPException(
                status_code=status.HTTP_422_UNPROCESSABLE_CONTENT,
                detail="Saved job and development plan role families do not match",
            )
    existing = list(
        db.scalars(
            select(DevelopmentPlanTask)
            .where(
                DevelopmentPlanTask.user_id == user.id,
                DevelopmentPlanTask.role_family == payload.role_family,
            )
            .order_by(DevelopmentPlanTask.position)
        )
    )
    if existing and not payload.replace:
        return existing
    if existing:
        db.execute(
            delete(DevelopmentPlanTask).where(
                DevelopmentPlanTask.user_id == user.id,
                DevelopmentPlanTask.role_family == payload.role_family,
            )
        )
        db.flush()

    priorities = development_plan_priorities(db, user.id, payload.role_family, saved_job)
    first_slug, first_name = priorities[0]
    second_slug, second_name = priorities[min(1, len(priorities) - 1)]
    third_slug, third_name = priorities[min(2, len(priorities) - 1)]
    specs = [
        (
            "diagnose", 2, first_slug, f"Define credible proof for {first_name}",
            "Translate the market requirement into acceptance criteria tied to a real technical workflow.",
            "A written evidence checklist with scope, users, constraints and acceptance criteria.",
        ),
        (
            "build", 6, first_slug, f"Build an inspectable {first_name} implementation",
            "Implement the capability in version-controlled work using representative data and documented decisions.",
            "Working code, reproducible setup and an architecture or decision record.",
        ),
        (
            "verify", 10, second_slug, f"Verify {second_name} with engineering evidence",
            "Add tests, data-quality checks, deployment evidence or measurable outcomes that can be independently inspected.",
            "Automated validation plus a recorded result, metric or deployed workflow.",
        ),
        (
            "validate", 12, third_slug, f"Validate the profile against current {third_name} demand",
            "Compare the completed work with current job advertisements and update the evidence profile from the result.",
            "A revised evidence profile and a shortlist of roles supported by the new proof.",
        ),
    ]
    tasks = [
        DevelopmentPlanTask(
            user_id=user.id,
            saved_job_id=saved_job.id if saved_job is not None else None,
            role_family=payload.role_family,
            skill_slug=skill_slug,
            stage=stage,
            position=index,
            due_week=due_week,
            title=title,
            description=description,
            deliverable=deliverable,
        )
        for index, (stage, due_week, skill_slug, title, description, deliverable) in enumerate(specs, start=1)
    ]
    db.add_all(tasks)
    audit(db, "plan.generated", user_id=user.id, metadata={
        "role_family": payload.role_family,
        "saved_job_id": str(saved_job.id) if saved_job is not None else None,
    })
    db.commit()
    for task in tasks:
        db.refresh(task)
    return tasks


@app.patch("/api/v1/plan/{task_id}", response_model=DevelopmentPlanTaskResponse)
def update_development_plan_task(
    task_id: UUID,
    payload: DevelopmentPlanTaskUpdateRequest,
    user: Annotated[User, Depends(verified_user)],
    db: Annotated[Session, Depends(get_db)],
) -> DevelopmentPlanTask:
    task = db.scalar(
        select(DevelopmentPlanTask).where(
            DevelopmentPlanTask.id == task_id,
            DevelopmentPlanTask.user_id == user.id,
        )
    )
    if task is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Development task not found")
    task.status = payload.status
    task.completed_at = datetime.now(UTC) if payload.status == "completed" else None
    audit(db, "plan.task_updated", user_id=user.id, metadata={"task_id": str(task.id), "status": task.status})
    db.commit()
    db.refresh(task)
    return task


@app.get("/api/v1/role-decoder/history", response_model=list[JobAnalysisSummaryResponse])
def role_decoder_history(
    user: Annotated[User, Depends(verified_user)], db: Annotated[Session, Depends(get_db)]
) -> list[JobAnalysis]:
    return list(
        db.scalars(
            select(JobAnalysis)
            .where(JobAnalysis.user_id == user.id)
            .order_by(JobAnalysis.created_at.desc())
            .limit(25)
        )
    )


@app.get("/api/v1/role-decoder/history/{analysis_id}", response_model=JobAnalysisDetailResponse)
def role_decoder_history_detail(
    analysis_id: UUID,
    user: Annotated[User, Depends(verified_user)],
    db: Annotated[Session, Depends(get_db)],
) -> JobAnalysisDetailResponse:
    analysis = db.scalar(
        select(JobAnalysis).where(JobAnalysis.id == analysis_id, JobAnalysis.user_id == user.id)
    )
    if analysis is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Role analysis not found")
    try:
        result = RoleDecodeResponse.model_validate(json.loads(analysis.result_json))
    except (TypeError, ValueError) as exc:
        raise HTTPException(status_code=status.HTTP_500_INTERNAL_SERVER_ERROR, detail="Saved role analysis is invalid") from exc
    result.analysis_id = analysis.id
    return JobAnalysisDetailResponse(
        id=analysis.id,
        title=analysis.title,
        description=analysis.description,
        role_family=analysis.role_family,
        scope_status=analysis.scope_status,
        confidence=analysis.confidence,
        created_at=analysis.created_at,
        result=result,
    )


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
        cv_label=payload.cv_label.strip() if payload.cv_label else None,
        target_role=payload.target_role,
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


@app.get("/api/v1/evidence/uploads/{upload_id}/status", response_model=list[ProcessingJobResponse])
def upload_processing_status(
    upload_id: UUID,
    user: Annotated[User, Depends(verified_user)],
    db: Annotated[Session, Depends(get_db)],
) -> list[ProcessingJob]:
    upload = db.scalar(select(EvidenceUpload.id).where(EvidenceUpload.id == upload_id, EvidenceUpload.user_id == user.id))
    if upload is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Upload not found")
    return list(
        db.scalars(
            select(ProcessingJob)
            .where(ProcessingJob.upload_id == upload_id)
            .order_by(ProcessingJob.created_at.asc())
        )
    )


@app.post("/api/v1/evidence/uploads/{upload_id}/retry", response_model=UploadResponse, status_code=status.HTTP_202_ACCEPTED)
def retry_upload_processing(
    upload_id: UUID,
    user: Annotated[User, Depends(verified_user)],
    db: Annotated[Session, Depends(get_db)],
) -> EvidenceUpload:
    upload = db.scalar(select(EvidenceUpload).where(EvidenceUpload.id == upload_id, EvidenceUpload.user_id == user.id))
    if upload is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Upload not found")
    if upload.status not in {"scan_failed", "parse_failed"}:
        raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail="This upload is not eligible for retry")
    job_type = "virus_scan" if upload.status == "scan_failed" else "document_parse"
    upload.status = "queued_for_scan" if job_type == "virus_scan" else "queued_for_parsing"
    upload.failure_reason = None
    db.add(ProcessingJob(upload_id=upload.id, job_type=job_type))
    audit(db, "evidence.processing_retried", user_id=user.id, metadata={"upload_id": str(upload.id), "job_type": job_type})
    db.commit()
    db.refresh(upload)
    return upload


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
    confirmed_slugs = {
        slug
        for suggestion in suggestions
        if decisions[suggestion.id] == "confirmed"
        for slug in [slug_for_name(suggestion.canonical_skill)]
        if slug is not None
    }
    ensure_canonical_skills(db, confirmed_slugs)
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
        .where(
            CandidateSkillEvidence.user_id == user.id,
        )
        .order_by(CandidateSkillEvidence.skill_slug)
    ))
    # Group by the canonical display name as well as the slug. This protects
    # the profile from legacy rows or taxonomy aliases that represent the same
    # capability under different identifiers.
    grouped: defaultdict[str, list[CandidateSkillEvidence]] = defaultdict(list)
    for item in items:
        skill_name = SKILLS[item.skill_slug][0].strip().casefold()
        grouped[skill_name].append(item)
    evidence = []
    for records in grouped.values():
        representative_skill_slug = min(records, key=lambda item: item.skill_slug).skill_slug
        aggregate = aggregate_evidence_strength(
            [
                EvidenceScoreInput(
                    evidence_level=item.evidence_level,
                    confidence=item.confidence,
                    excerpt=item.excerpt,
                    locator=item.locator,
                    source_type=item.source_type,
                    source_reference=f"{item.source_type}:{item.github_project_id or item.upload_id or item.locator}",
                )
                for item in records
            ]
        )
        representative = max(records, key=lambda item: (item.evidence_level, item.confidence))
        source_types = sorted({item.source_type for item in records})
        evidence.append(
            SkillEvidenceResponse(
                skill_slug=representative_skill_slug,
                skill_name=SKILLS[representative_skill_slug][0],
                category=SKILLS[representative_skill_slug][1],
                evidence_level=aggregate.evidence_level,
                confidence=aggregate.confidence,
                excerpt=representative.excerpt,
                locator=representative.locator,
                source_type=" + ".join(source_types),
            )
        )
    return SkillGraphResponse(
        role_family=role_family,
        evidence=sorted(evidence, key=lambda item: (-item.evidence_level, item.skill_name.lower())),
    )


@app.get("/api/v1/evidence/github/profile", response_model=list[GithubRepositoryCandidateResponse])
def list_github_profile_repositories(url: str, user: Annotated[User, Depends(verified_user)]) -> list[GithubRepositoryCandidateResponse]:
    try:
        return [GithubRepositoryCandidateResponse.model_validate(item.__dict__) for item in list_public_repositories(url)]
    except ValueError as exc:
        raise HTTPException(status_code=status.HTTP_422_UNPROCESSABLE_CONTENT, detail=str(exc)) from exc


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
    confirmed_slugs = {
        slug
        for suggestion in suggestions
        if decisions[suggestion.id] == "confirmed"
        for slug in [slug_for_name(suggestion.canonical_skill)]
        if slug is not None
    }
    ensure_canonical_skills(db, confirmed_slugs)
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
    evidence = aggregate_candidate_evidence(list(
        db.scalars(select(CandidateSkillEvidence).where(CandidateSkillEvidence.user_id == user.id))
    ))
    market_posting_count = db.scalar(
        select(func.count(JobPosting.id)).where(JobPosting.role_family == role_family)
    ) or 0
    market_skill_counts = dict(db.execute(
        select(JobPostingSkill.skill_slug, func.count(func.distinct(JobPostingSkill.posting_id)))
        .join(JobPosting, JobPosting.id == JobPostingSkill.posting_id)
        .where(JobPosting.role_family == role_family)
        .group_by(JobPostingSkill.skill_slug)
    ).all())

    def adjusted_weight(slug: str, base_weight: float) -> tuple[float, float, int]:
        """Calibrate the transparent occupational prior with observed posting frequency.

        A missing market signal keeps the prior intact. With data, a capability
        mentioned in every indexed posting can move the prior by at most 25%;
        an unobserved capability can fall by at most 25%. This prevents a small
        local sample from rewriting the occupational framework.
        """
        count = int(market_skill_counts.get(slug, 0))
        frequency = count / market_posting_count if market_posting_count else 0.0
        multiplier = 1.0 if not market_posting_count else 0.75 + 0.5 * min(1.0, frequency)
        return round(base_weight * multiplier, 3), round(frequency, 4), count

    skills = {
        skill.slug: skill
        for skill in db.scalars(
            select(CanonicalSkill).where(CanonicalSkill.slug.in_(slug for slug, _, _ in requirements))
        )
    }
    calibrated_requirements = [
        (slug, *adjusted_weight(slug, weight), required)
        for slug, weight, required in requirements
    ]
    total_weight = sum(weight for _, weight, _, _, _ in calibrated_requirements)
    covered_weight = sum(
        weight for slug, weight, _, _, _ in calibrated_requirements
        if slug in evidence and evidence[slug].evidence_level > 0
    )
    coverage = covered_weight / total_weight * 100
    contributions = []
    for slug, weight, market_frequency, market_mention_count, required in calibrated_requirements:
        summary = evidence.get(slug) or aggregate_evidence_strength([])
        strength = summary.strength
        contributions.append({
            "skill_slug": slug, "skill_name": skills[slug].name if slug in skills else SKILLS[slug][0],
            "weight": weight, "required": required, "evidence_level": summary.evidence_level,
            "market_frequency": market_frequency, "market_mention_count": market_mention_count,
            "evidence_confidence": summary.confidence,
            "source_count": summary.source_count, "source_type_count": summary.source_type_count,
            "base_score": strength.base_score,
            "confidence_adjustment": strength.confidence_adjustment,
            "specificity_bonus": strength.specificity_bonus,
            "verification_bonus": strength.verification_bonus,
            "outcome_bonus": strength.outcome_bonus,
            "corroboration_bonus": strength.corroboration_bonus,
            "diversity_bonus": strength.diversity_bonus,
            "score_factors": list(summary.score_factors),
            "normalized_score": strength.score, "weighted_score": round(strength.score * weight, 2),
        })
    depth = sum(item["weighted_score"] for item in contributions) / total_weight
    score = coverage * 0.65 + depth * 0.35
    cap_applied = any(required and slug not in evidence for slug, _, _, _, required in calibrated_requirements) and score > 59
    if cap_applied:
        score = 59
    return RoleFitResponse(
        role_family=role_family, score=round(score, 2), coverage=round(coverage, 2),
        evidence_depth=round(depth, 2), cap_applied=cap_applied, contributions=contributions,
        benchmark_sources=list(ROLE_BENCHMARK_SOURCES.get(role_family, {}).get("sources", [])),
        benchmark_methodology=(
            "O*NET and ESCO occupational skill descriptors, competency-modeling guidance from "
            "Campion et al. (2011), and indexed NZ posting frequency following Deming & Kahn (2018)."
        ),
        market_posting_count=market_posting_count,
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
    uploads = list(db.scalars(select(EvidenceUpload).where(EvidenceUpload.user_id == user.id)))
    evidence = list(db.scalars(select(CandidateSkillEvidence).where(CandidateSkillEvidence.user_id == user.id)))
    projects = list(db.scalars(select(GithubProject).where(GithubProject.user_id == user.id)))
    analyses = list(db.scalars(select(JobAnalysis).where(JobAnalysis.user_id == user.id)))
    jobs = list(db.scalars(select(SavedJob).where(SavedJob.user_id == user.id)))
    job_ids = [job.id for job in jobs]
    status_events = list(db.scalars(select(JobStatusEvent).where(JobStatusEvent.saved_job_id.in_(job_ids)))) if job_ids else []
    plan_tasks = list(db.scalars(select(DevelopmentPlanTask).where(DevelopmentPlanTask.user_id == user.id)))
    return {
        "exported_at": datetime.now(UTC).isoformat(),
        "account": {"id": str(user.id), "email": user.email, "display_name": user.display_name},
        "profile": profile_response(profile).model_dump(mode="json") if profile else None,
        "document_uploads": [
            {
                "id": str(item.id), "original_filename": item.original_filename, "content_type": item.content_type,
                "cv_label": item.cv_label, "target_role": item.target_role,
                "status": item.status, "created_at": item.created_at.isoformat(),
            }
            for item in uploads
        ],
        "confirmed_evidence": [
            {
                "skill_slug": item.skill_slug, "evidence_level": item.evidence_level,
                "confidence": item.confidence, "excerpt": item.excerpt, "locator": item.locator,
                "source_type": item.source_type, "created_at": item.created_at.isoformat(),
            }
            for item in evidence
        ],
        "github_projects": [
            {
                "id": str(item.id), "url": item.canonical_url, "repository": item.repository,
                "description": item.description, "status": item.status, "fetched_at": item.fetched_at.isoformat(),
            }
            for item in projects
        ],
        "role_analyses": [
            {
                "id": str(item.id), "title": item.title, "description": item.description,
                "role_family": item.role_family, "scope_status": item.scope_status,
                "confidence": item.confidence, "result": json.loads(item.result_json),
                "created_at": item.created_at.isoformat(),
            }
            for item in analyses
        ],
        "saved_jobs": [
            {
                "id": str(item.id), "analysis_id": str(item.analysis_id) if item.analysis_id else None,
                "source_url": item.source_url, "title": item.title, "company": item.company,
                "location": item.location, "role_family": item.role_family, "status": item.status,
                "notes": item.notes, "created_at": item.created_at.isoformat(), "updated_at": item.updated_at.isoformat(),
            }
            for item in jobs
        ],
        "application_history": [
            {
                "saved_job_id": str(item.saved_job_id), "from_status": item.from_status,
                "to_status": item.to_status, "changed_at": item.changed_at.isoformat(),
            }
            for item in status_events
        ],
        "development_plan": [
            {
                "id": str(item.id), "role_family": item.role_family, "skill_slug": item.skill_slug,
                "stage": item.stage, "title": item.title, "description": item.description,
                "deliverable": item.deliverable, "status": item.status,
                "completed_at": item.completed_at.isoformat() if item.completed_at else None,
            }
            for item in plan_tasks
        ],
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
