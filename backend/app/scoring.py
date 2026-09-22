from dataclasses import dataclass

from .schemas import DimensionScoreRequest


@dataclass(frozen=True)
class ScoreResult:
    score: float
    coverage: float
    evidence_depth: float
    cap_applied: bool
    contributions: list[dict[str, str | float]]


def calculate_dimension_score(request: DimensionScoreRequest) -> ScoreResult:
    """Calculate documented evidence coverage without model-generated numbers."""
    total_weight = sum(item.weight for item in request.evidence)
    covered_weight = sum(item.weight for item in request.evidence if item.evidence_level > 0)
    coverage = covered_weight / total_weight * 100

    contributions: list[dict[str, str | float]] = []
    weighted_depth = 0.0
    for item in request.evidence:
        normalized = (
            item.evidence_level / 5
            * item.quality_factor
            * item.recency_factor
            * item.verification_factor
            * item.role_relevance
            * 100
        )
        weighted = normalized * item.weight
        weighted_depth += weighted
        contributions.append(
            {"skill": item.skill, "normalized_score": round(normalized, 2), "weighted_score": round(weighted, 2)}
        )

    evidence_depth = weighted_depth / total_weight
    score = coverage * 0.65 + evidence_depth * 0.35
    missing_required = any(item.required and item.evidence_level == 0 for item in request.evidence)
    cap_applied = missing_required and score > 59
    if cap_applied:
        score = 59

    return ScoreResult(
        score=round(score, 2),
        coverage=round(coverage, 2),
        evidence_depth=round(evidence_depth, 2),
        cap_applied=cap_applied,
        contributions=contributions,
    )
