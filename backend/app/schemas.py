from datetime import datetime
from typing import Literal
from uuid import UUID

from pydantic import BaseModel, EmailStr, Field, HttpUrl, model_validator


class EvidenceItem(BaseModel):
    skill: str = Field(min_length=1, max_length=100)
    evidence_level: int = Field(ge=0, le=5)
    quality_factor: float = Field(ge=0, le=1)
    recency_factor: float = Field(ge=0, le=1)
    verification_factor: float = Field(ge=0, le=1)
    role_relevance: float = Field(ge=0, le=1)
    weight: float = Field(gt=0, le=10)
    required: bool = False


class DimensionScoreRequest(BaseModel):
    target_role: str = Field(min_length=1, max_length=100)
    location: str = Field(default="New Zealand", min_length=1, max_length=100)
    seniority: Literal["graduate", "junior", "mid", "senior", "lead"]
    market_window_days: int = Field(default=90, ge=7, le=730)
    evidence: list[EvidenceItem] = Field(min_length=1, max_length=100)

    @model_validator(mode="after")
    def unique_skills(self) -> "DimensionScoreRequest":
        names = [item.skill.casefold() for item in self.evidence]
        if len(names) != len(set(names)):
            raise ValueError("Each skill must appear only once")
        return self


class SkillContribution(BaseModel):
    skill: str
    normalized_score: float
    weighted_score: float


class DimensionScoreResponse(BaseModel):
    score: float
    coverage: float
    evidence_depth: float
    cap_applied: bool
    contributions: list[SkillContribution]
    context: dict[str, str | int]


class RoleFamily(BaseModel):
    id: str
    label: str
    status: Literal["active", "planned"]


class RegisterRequest(BaseModel):
    email: EmailStr
    password: str = Field(min_length=12, max_length=128)
    display_name: str = Field(min_length=1, max_length=120)


class LoginRequest(BaseModel):
    email: EmailStr
    password: str = Field(min_length=1, max_length=128)


class UserResponse(BaseModel):
    id: UUID
    email: EmailStr
    display_name: str
    is_verified: bool

    model_config = {"from_attributes": True}


class AuthResponse(BaseModel):
    access_token: str
    expires_in: int
    user: UserResponse


class EmailRequest(BaseModel):
    email: EmailStr


class TokenRequest(BaseModel):
    token: str = Field(min_length=32, max_length=256)


class ResetPasswordRequest(TokenRequest):
    password: str = Field(min_length=12, max_length=128)


class DeleteAccountRequest(BaseModel):
    password: str = Field(min_length=1, max_length=128)


class UploadInitiateRequest(BaseModel):
    filename: str = Field(min_length=1, max_length=255)
    content_type: Literal[
        "application/pdf",
        "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
    ]
    size: int = Field(gt=0)


class UploadInitiateResponse(BaseModel):
    id: UUID
    upload_url: str
    storage_key: str
    expires_in: int = 600


class UploadResponse(BaseModel):
    id: UUID
    original_filename: str
    content_type: str
    expected_size: int
    actual_size: int | None
    status: str
    failure_reason: str | None
    created_at: datetime

    model_config = {"from_attributes": True}


class EvidenceSuggestionResponse(BaseModel):
    id: UUID
    canonical_skill: str
    category: str
    excerpt: str
    locator: str
    confidence: float
    proposed_level: int
    review_status: str

    model_config = {"from_attributes": True}


class ExtractionResponse(BaseModel):
    upload_id: UUID
    parser_version: str
    character_count: int
    page_count: int | None
    suggestions: list[EvidenceSuggestionResponse]


class EvidenceDecision(BaseModel):
    suggestion_id: UUID
    decision: Literal["confirmed", "rejected"]


class EvidenceReviewRequest(BaseModel):
    decisions: list[EvidenceDecision] = Field(min_length=1, max_length=100)

    @model_validator(mode="after")
    def unique_suggestions(self) -> "EvidenceReviewRequest":
        ids = [decision.suggestion_id for decision in self.decisions]
        if len(ids) != len(set(ids)):
            raise ValueError("Each suggestion must have exactly one decision")
        return self


class SkillEvidenceResponse(BaseModel):
    skill_slug: str
    skill_name: str
    category: str
    evidence_level: int
    confidence: float
    excerpt: str
    locator: str
    source_type: str


class SkillGraphResponse(BaseModel):
    role_family: str
    evidence: list[SkillEvidenceResponse]


class RoleFitContribution(BaseModel):
    skill_slug: str
    skill_name: str
    weight: float
    required: bool
    evidence_level: int
    normalized_score: float
    weighted_score: float


class RoleFitResponse(BaseModel):
    role_family: str
    score: float
    coverage: float
    evidence_depth: float
    cap_applied: bool
    contributions: list[RoleFitContribution]


class GithubProjectRequest(BaseModel):
    url: HttpUrl


class GithubSuggestionResponse(BaseModel):
    id: UUID
    canonical_skill: str
    category: str
    excerpt: str
    confidence: float
    proposed_level: int
    review_status: str

    model_config = {"from_attributes": True}


class GithubProjectResponse(BaseModel):
    id: UUID
    canonical_url: str
    repository: str
    description: str | None
    stars: int
    language: str | None
    topics: list[str]
    status: str
    suggestions: list[GithubSuggestionResponse] = []

    model_config = {"from_attributes": True}


class EvidenceSourceInput(BaseModel):
    source_type: Literal["github", "portfolio"]
    source_reference: HttpUrl


class ProfileSetupRequest(BaseModel):
    role_family: Literal["software", "data-analyst", "data-engineer", "ai", "cloud-devops"]
    location: str = Field(min_length=1, max_length=120)
    seniority: Literal["Graduate / Junior", "Intermediate", "Senior", "Lead / Manager"]
    evidence_sources: list[EvidenceSourceInput] = Field(default_factory=list, max_length=10)


class EvidenceSourceResponse(BaseModel):
    id: UUID
    source_type: str
    source_reference: str
    processing_status: str

    model_config = {"from_attributes": True}


class ProfileResponse(BaseModel):
    id: UUID
    location: str
    seniority: str
    role_family: str
    evidence_sources: list[EvidenceSourceResponse]
    updated_at: datetime


class RoleDecodeRequest(BaseModel):
    title: str = Field(min_length=2, max_length=240)
    description: str = Field(min_length=40, max_length=50_000)


class DecodedSkill(BaseModel):
    slug: str
    name: str
    mention_count: int


class RoleDecodeResponse(BaseModel):
    role_family: str
    role_label: str
    confidence: float
    seniority: str
    matched_skills: list[DecodedSkill]
    alternatives: list[dict[str, str | float]]


class MarketSourceInput(BaseModel):
    name: str = Field(min_length=2, max_length=160)
    source_type: Literal["company-careers", "greenhouse", "lever", "licensed-dataset", "manual-permitted"]
    permission_basis: str = Field(min_length=10, max_length=1000)
    base_url: HttpUrl


class JobPostingInput(BaseModel):
    source_url: HttpUrl
    title: str = Field(min_length=2, max_length=240)
    company: str = Field(min_length=1, max_length=180)
    location: str = Field(min_length=1, max_length=120)
    description: str = Field(min_length=40, max_length=50_000)
    published_at: datetime | None = None


class MarketImportRequest(BaseModel):
    source: MarketSourceInput
    postings: list[JobPostingInput] = Field(min_length=1, max_length=500)


class MarketSummaryResponse(BaseModel):
    posting_count: int
    roles: list[dict[str, str | int]]
    top_skills: list[dict[str, str | int]]
    locations: list[dict[str, str | int]]


class CollectorSourceRequest(BaseModel):
    name: str = Field(min_length=2, max_length=160)
    adapter: Literal["greenhouse", "lever", "schema-org"]
    identifier: str = Field(min_length=1, max_length=2000)
    company: str = Field(min_length=1, max_length=180)
    permission_basis: str = Field(min_length=10, max_length=1000)


class CollectorSourceResponse(BaseModel):
    id: UUID
    name: str
    adapter: str
    identifier: str
    company: str
    permission_basis: str
    enabled: bool
    created_at: datetime

    model_config = {"from_attributes": True}


class CollectorRunResponse(BaseModel):
    id: UUID
    collector_source_id: UUID
    status: str
    fetched_count: int
    accepted_count: int
    rejected_count: int
    error_message: str | None
    started_at: datetime
    completed_at: datetime | None

    model_config = {"from_attributes": True}


class MarketQualityResponse(BaseModel):
    posting_count: int
    missing_publication_date_percent: float
    low_confidence_count: int
    stale_posting_count: int
    duplicate_url_count: int
    collector_completed_count: int
    collector_failed_count: int
    sources: list[dict[str, str | int | bool | None]]


class RagIndexRequest(BaseModel):
    limit: int = Field(default=500, ge=1, le=5000)


class RagIndexResponse(BaseModel):
    indexed_postings: int
    skipped_postings: int
    created_chunks: int


class EvidenceSearchRequest(BaseModel):
    query: str = Field(min_length=3, max_length=500)
    role_family: str | None = Field(default=None, max_length=80)
    location: str | None = Field(default=None, max_length=120)
    seniority: str | None = Field(default=None, max_length=50)
    market_window_days: int | None = Field(default=180, ge=7, le=730)
    limit: int = Field(default=8, ge=1, le=20)


class EvidenceCitation(BaseModel):
    citation_id: str
    title: str
    company: str
    location: str
    role_family: str
    seniority: str
    source_url: str
    published_at: datetime | None
    excerpt: str
    retrieval_score: float


class EvidenceSearchResponse(BaseModel):
    query: str
    result_count: int
    citations: list[EvidenceCitation]
    retrieval_method: str = "filtered hybrid RRF: PostgreSQL FTS + pgvector cosine"


class RagEvaluationResponse(BaseModel):
    status: Literal["ok", "insufficient_data"]
    case_count: int
    evaluated_cases: int
    k: int | None = None
    recall_at_k: float | None
    mean_reciprocal_rank: float | None
    failures: list[dict[str, str]]
