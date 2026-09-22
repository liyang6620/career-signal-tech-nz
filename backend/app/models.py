import uuid
from datetime import datetime

from pgvector.sqlalchemy import Vector
from sqlalchemy import Boolean, DateTime, Float, ForeignKey, Integer, String, Text, UniqueConstraint, func
from sqlalchemy.orm import Mapped, mapped_column, relationship

from .database import Base


class User(Base):
    __tablename__ = "users"

    id: Mapped[uuid.UUID] = mapped_column(primary_key=True, default=uuid.uuid4)
    email: Mapped[str] = mapped_column(String(320), unique=True, index=True)
    password_hash: Mapped[str] = mapped_column(Text)
    display_name: Mapped[str] = mapped_column(String(120))
    is_active: Mapped[bool] = mapped_column(Boolean, default=True)
    is_verified: Mapped[bool] = mapped_column(Boolean, default=False)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), onupdate=func.now()
    )

    profile: Mapped["CareerProfile | None"] = relationship(back_populates="user", cascade="all, delete-orphan")


class RefreshSession(Base):
    __tablename__ = "refresh_sessions"

    id: Mapped[uuid.UUID] = mapped_column(primary_key=True, default=uuid.uuid4)
    user_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("users.id", ondelete="CASCADE"), index=True)
    token_hash: Mapped[str] = mapped_column(String(64), unique=True, index=True)
    expires_at: Mapped[datetime] = mapped_column(DateTime(timezone=True))
    revoked_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())


class OneTimeToken(Base):
    __tablename__ = "one_time_tokens"

    id: Mapped[uuid.UUID] = mapped_column(primary_key=True, default=uuid.uuid4)
    user_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("users.id", ondelete="CASCADE"), index=True)
    purpose: Mapped[str] = mapped_column(String(30), index=True)
    token_hash: Mapped[str] = mapped_column(String(64), unique=True, index=True)
    expires_at: Mapped[datetime] = mapped_column(DateTime(timezone=True))
    used_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())


class AuditEvent(Base):
    __tablename__ = "audit_events"

    id: Mapped[uuid.UUID] = mapped_column(primary_key=True, default=uuid.uuid4)
    user_id: Mapped[uuid.UUID | None] = mapped_column(ForeignKey("users.id", ondelete="SET NULL"), index=True)
    event_type: Mapped[str] = mapped_column(String(80), index=True)
    actor_fingerprint: Mapped[str | None] = mapped_column(String(64), index=True)
    event_metadata: Mapped[str | None] = mapped_column(Text)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now(), index=True)


class CareerProfile(Base):
    __tablename__ = "career_profiles"

    id: Mapped[uuid.UUID] = mapped_column(primary_key=True, default=uuid.uuid4)
    user_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("users.id", ondelete="CASCADE"), unique=True, index=True)
    location: Mapped[str] = mapped_column(String(120))
    seniority: Mapped[str] = mapped_column(String(50))
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), onupdate=func.now()
    )

    user: Mapped[User] = relationship(back_populates="profile")
    targets: Mapped[list["CareerTarget"]] = relationship(cascade="all, delete-orphan")
    evidence_sources: Mapped[list["EvidenceSource"]] = relationship(cascade="all, delete-orphan")


class CareerTarget(Base):
    __tablename__ = "career_targets"
    __table_args__ = (UniqueConstraint("profile_id", "role_family"),)

    id: Mapped[uuid.UUID] = mapped_column(primary_key=True, default=uuid.uuid4)
    profile_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("career_profiles.id", ondelete="CASCADE"), index=True)
    role_family: Mapped[str] = mapped_column(String(80))
    is_primary: Mapped[bool] = mapped_column(Boolean, default=False)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())


class EvidenceSource(Base):
    __tablename__ = "evidence_sources"

    id: Mapped[uuid.UUID] = mapped_column(primary_key=True, default=uuid.uuid4)
    profile_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("career_profiles.id", ondelete="CASCADE"), index=True)
    source_type: Mapped[str] = mapped_column(String(30))
    source_reference: Mapped[str] = mapped_column(Text)
    processing_status: Mapped[str] = mapped_column(String(30), default="pending")
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())


class EvidenceUpload(Base):
    __tablename__ = "evidence_uploads"

    id: Mapped[uuid.UUID] = mapped_column(primary_key=True, default=uuid.uuid4)
    user_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("users.id", ondelete="CASCADE"), index=True)
    storage_key: Mapped[str] = mapped_column(Text, unique=True)
    original_filename: Mapped[str] = mapped_column(String(255))
    content_type: Mapped[str] = mapped_column(String(100))
    expected_size: Mapped[int] = mapped_column()
    actual_size: Mapped[int | None] = mapped_column()
    status: Mapped[str] = mapped_column(String(30), default="pending_upload", index=True)
    failure_reason: Mapped[str | None] = mapped_column(String(255))
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), onupdate=func.now()
    )


class ProcessingJob(Base):
    __tablename__ = "processing_jobs"

    id: Mapped[uuid.UUID] = mapped_column(primary_key=True, default=uuid.uuid4)
    upload_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("evidence_uploads.id", ondelete="CASCADE"), index=True)
    job_type: Mapped[str] = mapped_column(String(40), index=True)
    status: Mapped[str] = mapped_column(String(20), default="queued", index=True)
    attempts: Mapped[int] = mapped_column(default=0)
    available_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now(), index=True)
    locked_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))
    last_error: Mapped[str | None] = mapped_column(Text)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), onupdate=func.now()
    )


class DocumentExtraction(Base):
    __tablename__ = "document_extractions"

    id: Mapped[uuid.UUID] = mapped_column(primary_key=True, default=uuid.uuid4)
    upload_id: Mapped[uuid.UUID] = mapped_column(
        ForeignKey("evidence_uploads.id", ondelete="CASCADE"), unique=True, index=True
    )
    parser_version: Mapped[str] = mapped_column(String(40))
    text_sha256: Mapped[str] = mapped_column(String(64))
    character_count: Mapped[int] = mapped_column(Integer)
    page_count: Mapped[int | None] = mapped_column(Integer)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())


class EvidenceSuggestion(Base):
    __tablename__ = "evidence_suggestions"
    __table_args__ = (UniqueConstraint("extraction_id", "canonical_skill"),)

    id: Mapped[uuid.UUID] = mapped_column(primary_key=True, default=uuid.uuid4)
    extraction_id: Mapped[uuid.UUID] = mapped_column(
        ForeignKey("document_extractions.id", ondelete="CASCADE"), index=True
    )
    canonical_skill: Mapped[str] = mapped_column(String(100), index=True)
    category: Mapped[str] = mapped_column(String(60))
    excerpt: Mapped[str] = mapped_column(Text)
    locator: Mapped[str] = mapped_column(String(80))
    confidence: Mapped[float] = mapped_column(Float)
    proposed_level: Mapped[int] = mapped_column(Integer)
    review_status: Mapped[str] = mapped_column(String(20), default="pending", index=True)
    reviewed_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())


class CanonicalSkill(Base):
    __tablename__ = "canonical_skills"

    slug: Mapped[str] = mapped_column(String(100), primary_key=True)
    name: Mapped[str] = mapped_column(String(100), unique=True)
    category: Mapped[str] = mapped_column(String(60), index=True)
    taxonomy_version: Mapped[str] = mapped_column(String(20), default="2026.1")


class RoleSkillRequirement(Base):
    __tablename__ = "role_skill_requirements"
    __table_args__ = (UniqueConstraint("role_family", "skill_slug"),)

    id: Mapped[uuid.UUID] = mapped_column(primary_key=True, default=uuid.uuid4)
    role_family: Mapped[str] = mapped_column(String(80), index=True)
    skill_slug: Mapped[str] = mapped_column(ForeignKey("canonical_skills.slug"), index=True)
    weight: Mapped[float] = mapped_column(Float)
    required: Mapped[bool] = mapped_column(Boolean, default=False)


class CandidateSkillEvidence(Base):
    __tablename__ = "candidate_skill_evidence"

    id: Mapped[uuid.UUID] = mapped_column(primary_key=True, default=uuid.uuid4)
    user_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("users.id", ondelete="CASCADE"), index=True)
    upload_id: Mapped[uuid.UUID | None] = mapped_column(
        ForeignKey("evidence_uploads.id", ondelete="CASCADE"), index=True
    )
    github_project_id: Mapped[uuid.UUID | None] = mapped_column(
        ForeignKey("github_projects.id", ondelete="CASCADE"), index=True
    )
    suggestion_id: Mapped[uuid.UUID | None] = mapped_column(
        ForeignKey("evidence_suggestions.id", ondelete="CASCADE"), unique=True, index=True
    )
    github_suggestion_id: Mapped[uuid.UUID | None] = mapped_column(
        ForeignKey("github_suggestions.id", ondelete="CASCADE"), unique=True, index=True
    )
    skill_slug: Mapped[str] = mapped_column(ForeignKey("canonical_skills.slug"), index=True)
    evidence_level: Mapped[int] = mapped_column(Integer)
    confidence: Mapped[float] = mapped_column(Float)
    excerpt: Mapped[str] = mapped_column(Text)
    locator: Mapped[str] = mapped_column(String(80))
    source_type: Mapped[str] = mapped_column(String(30), default="cv")
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())


class GithubProject(Base):
    __tablename__ = "github_projects"
    __table_args__ = (UniqueConstraint("user_id", "canonical_url"),)

    id: Mapped[uuid.UUID] = mapped_column(primary_key=True, default=uuid.uuid4)
    user_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("users.id", ondelete="CASCADE"), index=True)
    canonical_url: Mapped[str] = mapped_column(Text)
    owner: Mapped[str] = mapped_column(String(100))
    repository: Mapped[str] = mapped_column(String(100))
    description: Mapped[str | None] = mapped_column(Text)
    default_branch: Mapped[str | None] = mapped_column(String(120))
    stars: Mapped[int] = mapped_column(Integer, default=0)
    language: Mapped[str | None] = mapped_column(String(80))
    topics: Mapped[str] = mapped_column(Text, default="[]")
    readme_excerpt: Mapped[str | None] = mapped_column(Text)
    status: Mapped[str] = mapped_column(String(30), default="awaiting_review", index=True)
    fetched_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())


class GithubSuggestion(Base):
    __tablename__ = "github_suggestions"
    __table_args__ = (UniqueConstraint("project_id", "canonical_skill"),)

    id: Mapped[uuid.UUID] = mapped_column(primary_key=True, default=uuid.uuid4)
    project_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("github_projects.id", ondelete="CASCADE"), index=True)
    canonical_skill: Mapped[str] = mapped_column(String(100), index=True)
    category: Mapped[str] = mapped_column(String(60))
    excerpt: Mapped[str] = mapped_column(Text)
    confidence: Mapped[float] = mapped_column(Float)
    proposed_level: Mapped[int] = mapped_column(Integer)
    review_status: Mapped[str] = mapped_column(String(20), default="pending", index=True)
    reviewed_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))


class MarketSource(Base):
    __tablename__ = "market_sources"

    id: Mapped[uuid.UUID] = mapped_column(primary_key=True, default=uuid.uuid4)
    name: Mapped[str] = mapped_column(String(160))
    source_type: Mapped[str] = mapped_column(String(50))
    permission_basis: Mapped[str] = mapped_column(Text)
    base_url: Mapped[str] = mapped_column(Text)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())


class JobPosting(Base):
    __tablename__ = "job_postings"

    id: Mapped[uuid.UUID] = mapped_column(primary_key=True, default=uuid.uuid4)
    source_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("market_sources.id", ondelete="RESTRICT"), index=True)
    source_url: Mapped[str] = mapped_column(Text, unique=True)
    content_hash: Mapped[str] = mapped_column(String(64), index=True)
    title: Mapped[str] = mapped_column(String(240))
    company: Mapped[str] = mapped_column(String(180))
    location: Mapped[str] = mapped_column(String(120), index=True)
    description: Mapped[str] = mapped_column(Text)
    role_family: Mapped[str] = mapped_column(String(80), index=True)
    seniority: Mapped[str] = mapped_column(String(50), index=True)
    classification_confidence: Mapped[float] = mapped_column(Float)
    published_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), index=True)
    retrieved_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())


class JobPostingSkill(Base):
    __tablename__ = "job_posting_skills"
    __table_args__ = (UniqueConstraint("posting_id", "skill_slug"),)

    id: Mapped[uuid.UUID] = mapped_column(primary_key=True, default=uuid.uuid4)
    posting_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("job_postings.id", ondelete="CASCADE"), index=True)
    skill_slug: Mapped[str] = mapped_column(ForeignKey("canonical_skills.slug"), index=True)
    mention_count: Mapped[int] = mapped_column(Integer)


class CollectorSource(Base):
    __tablename__ = "collector_sources"
    __table_args__ = (UniqueConstraint("adapter", "identifier"),)

    id: Mapped[uuid.UUID] = mapped_column(primary_key=True, default=uuid.uuid4)
    name: Mapped[str] = mapped_column(String(160))
    adapter: Mapped[str] = mapped_column(String(30), index=True)
    identifier: Mapped[str] = mapped_column(Text)
    company: Mapped[str] = mapped_column(String(180))
    permission_basis: Mapped[str] = mapped_column(Text)
    enabled: Mapped[bool] = mapped_column(Boolean, default=True)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())


class CollectorRun(Base):
    __tablename__ = "collector_runs"

    id: Mapped[uuid.UUID] = mapped_column(primary_key=True, default=uuid.uuid4)
    collector_source_id: Mapped[uuid.UUID] = mapped_column(
        ForeignKey("collector_sources.id", ondelete="CASCADE"), index=True
    )
    status: Mapped[str] = mapped_column(String(20), index=True)
    fetched_count: Mapped[int] = mapped_column(Integer, default=0)
    accepted_count: Mapped[int] = mapped_column(Integer, default=0)
    rejected_count: Mapped[int] = mapped_column(Integer, default=0)
    error_message: Mapped[str | None] = mapped_column(Text)
    started_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())
    completed_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))


class JobChunk(Base):
    __tablename__ = "rag_job_chunks"
    __table_args__ = (UniqueConstraint("posting_id", "chunk_index"),)

    id: Mapped[uuid.UUID] = mapped_column(primary_key=True, default=uuid.uuid4)
    posting_id: Mapped[uuid.UUID] = mapped_column(
        ForeignKey("job_postings.id", ondelete="CASCADE"), index=True
    )
    chunk_index: Mapped[int] = mapped_column(Integer)
    content: Mapped[str] = mapped_column(Text)
    posting_content_hash: Mapped[str] = mapped_column(String(64), index=True)
    embedding_model: Mapped[str] = mapped_column(String(120))
    embedding: Mapped[list[float]] = mapped_column(Vector(384))
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())


class RetrievalJudgement(Base):
    __tablename__ = "rag_retrieval_judgements"
    __table_args__ = (UniqueConstraint("user_id", "query_hash", "chunk_id"),)

    id: Mapped[uuid.UUID] = mapped_column(primary_key=True, default=uuid.uuid4)
    user_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("users.id", ondelete="CASCADE"), index=True)
    chunk_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("rag_job_chunks.id", ondelete="CASCADE"), index=True)
    query_hash: Mapped[str] = mapped_column(String(64), index=True)
    query_text: Mapped[str] = mapped_column(String(500))
    role_family: Mapped[str | None] = mapped_column(String(80))
    location: Mapped[str | None] = mapped_column(String(120))
    seniority: Mapped[str | None] = mapped_column(String(50))
    result_rank: Mapped[int] = mapped_column(Integer)
    relevant: Mapped[bool] = mapped_column(Boolean)
    notes: Mapped[str | None] = mapped_column(String(500))
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())
