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
