from datetime import UTC, datetime, timedelta
from typing import Annotated

from fastapi import Cookie, Depends, FastAPI, HTTPException, Response, status
from fastapi.middleware.cors import CORSMiddleware
from sqlalchemy import delete, select
from sqlalchemy.orm import Session, selectinload

from .auth import create_access_token, current_user, hash_password, new_refresh_token, token_digest, verify_password
from .config import get_settings
from .database import get_db
from .models import CareerProfile, CareerTarget, EvidenceSource, RefreshSession, User
from .schemas import (
    AuthResponse,
    DimensionScoreRequest,
    DimensionScoreResponse,
    LoginRequest,
    ProfileResponse,
    ProfileSetupRequest,
    RegisterRequest,
    RoleFamily,
    UserResponse,
)
from .scoring import calculate_dimension_score

settings = get_settings()
app = FastAPI(title=settings.app_name, version="0.1.0")
app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.allowed_origins,
    allow_credentials=True,
    allow_methods=["GET", "POST"],
    allow_headers=["Content-Type", "Authorization"],
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
def register(payload: RegisterRequest, response: Response, db: Annotated[Session, Depends(get_db)]) -> AuthResponse:
    email = payload.email.lower()
    if db.scalar(select(User.id).where(User.email == email)):
        raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail="An account with this email already exists")
    user = User(email=email, password_hash=hash_password(payload.password), display_name=payload.display_name.strip())
    db.add(user)
    db.commit()
    db.refresh(user)
    return issue_session(response, user, db)


@app.post("/api/v1/auth/login", response_model=AuthResponse)
def login(payload: LoginRequest, response: Response, db: Annotated[Session, Depends(get_db)]) -> AuthResponse:
    user = db.scalar(select(User).where(User.email == payload.email.lower(), User.is_active.is_(True)))
    if user is None or not verify_password(payload.password, user.password_hash):
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Invalid email or password")
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
    user: Annotated[User, Depends(current_user)],
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
    user: Annotated[User, Depends(current_user)], db: Annotated[Session, Depends(get_db)]
) -> ProfileResponse:
    profile = db.scalar(
        select(CareerProfile)
        .options(selectinload(CareerProfile.targets), selectinload(CareerProfile.evidence_sources))
        .where(CareerProfile.user_id == user.id)
    )
    if profile is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Profile not created")
    return profile_response(profile)


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
