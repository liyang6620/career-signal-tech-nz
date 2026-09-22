from typing import Literal

from pydantic import BaseModel, Field, model_validator


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
