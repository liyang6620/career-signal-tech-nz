import re
from collections.abc import Iterable
from dataclasses import dataclass
from math import log2

from .schemas import DimensionScoreRequest


@dataclass(frozen=True)
class ScoreResult:
    score: float
    coverage: float
    evidence_depth: float
    cap_applied: bool
    contributions: list[dict[str, str | float]]


@dataclass(frozen=True)
class EvidenceStrengthResult:
    score: float
    base_score: float
    confidence_adjustment: float
    specificity_bonus: float
    verification_bonus: float
    outcome_bonus: float
    corroboration_bonus: float
    diversity_bonus: float


@dataclass(frozen=True)
class EvidenceTextSignals:
    supported_level: int
    specificity: float
    verification: float
    outcome: float
    claim_only: bool
    professional_context: bool
    reasons: tuple[str, ...]


@dataclass(frozen=True)
class EvidenceScoreInput:
    evidence_level: int
    confidence: float
    excerpt: str
    locator: str
    source_type: str
    source_reference: str


@dataclass(frozen=True)
class AggregatedEvidenceStrength:
    evidence_level: int
    confidence: float
    source_count: int
    source_type_count: int
    strength: EvidenceStrengthResult
    score_factors: tuple[str, ...]


@dataclass(frozen=True)
class JobDemandResult:
    score: float
    explicit_mention: float
    repetition_signal: float
    requirement_signal: float
    title_signal: float


# The scale describes evidence maturity, not proficiency. The evidence-level ceiling
# prevents several weak mentions from being mistaken for verified implementation.
EVIDENCE_LEVEL_BASE = (0.0, 34.0, 59.0, 75.0, 88.0, 96.0)
EVIDENCE_LEVEL_CAP = (0.0, 45.0, 72.0, 86.0, 96.0, 100.0)
REQUIREMENT_SIGNALS = {"essential": 35.0, "named": 20.0, "supporting": 8.0}

USAGE_PATTERN = re.compile(
    r"\b(use[ds]?|using|appl(?:y|ied)|work(?:ed|ing)?\s+with|analys(?:e|ed|ing)|analyz(?:e|ed|ing)|"
    r"quer(?:y|ied|ying)|visuali[sz](?:e|ed|ing)|report(?:ed|ing)?|maintain(?:ed|ing)?)\b",
    re.I,
)
IMPLEMENTATION_PATTERN = re.compile(
    r"\b(built|developed|implemented|designed|created|automated|integrated|engineered|configured|migrated|"
    r"optimised|optimized|orchestrated|modelled|modeled|programmed|refactored)\b",
    re.I,
)
VERIFICATION_PATTERNS = (
    re.compile(r"\b(unit|integration|end[- ]to[- ]end|e2e|automated)?\s*tests?|tested|test coverage\b", re.I),
    re.compile(r"\b(ci/?cd|continuous integration|github actions|pipeline checks?)\b", re.I),
    re.compile(r"\b(deploy(?:ed|ment)?|production|released?|shipped)\b", re.I),
    re.compile(r"\b(validat(?:e|ed|ion)|monitor(?:ed|ing)?|data quality|quality checks?|observability)\b", re.I),
)
ARTIFACT_PATTERN = re.compile(
    r"\b(api|application|dashboard|database|data model|dataset|model|pipeline|query|queries|report|schema|"
    r"service|system|workflow|repository|implementation files?|configuration|manifest)\b",
    re.I,
)
OUTCOME_NUMBER_PATTERN = re.compile(
    r"(?:\b\d+(?:\.\d+)?\s*(?:%|percent|hours?|days?|weeks?|users?|customers?|records?|rows?|requests?)\b|"
    r"\$\s*\d[\d,.]*|\b\d+[x×]\b)",
    re.I,
)
OUTCOME_LANGUAGE_PATTERN = re.compile(
    r"\b(reduc(?:e|ed|ing)|increas(?:e|ed|ing)|improv(?:e|ed|ing)|sav(?:e|ed|ing)|accelerat(?:e|ed|ing)|"
    r"cut|grew|growth|accuracy|latency|throughput|adoption|revenue|cost|efficien(?:cy|t))\b",
    re.I,
)
PROFESSIONAL_LOCATOR_PATTERN = re.compile(
    r"\b(experience|employment|work history|internship|professional|client|consulting)\b",
    re.I,
)


def assess_evidence_text(excerpt: str, source_type: str = "cv", locator: str = "") -> EvidenceTextSignals:
    """Extract explainable quality signals from a reviewed evidence excerpt."""
    text = " ".join(excerpt.split())
    usage = bool(USAGE_PATTERN.search(text))
    implementation = bool(IMPLEMENTATION_PATTERN.search(text))
    verification_hits = sum(bool(pattern.search(text)) for pattern in VERIFICATION_PATTERNS)
    artifact_hits = len(ARTIFACT_PATTERN.findall(text))
    has_number = bool(OUTCOME_NUMBER_PATTERN.search(text))
    has_outcome_language = bool(OUTCOME_LANGUAGE_PATTERN.search(text))
    professional_context = bool(PROFESSIONAL_LOCATOR_PATTERN.search(locator))
    github_structure = source_type == "github" and bool(
        re.search(r"\b(repository|files?|dependency|configuration|workflow|manifest|models?)\b", text, re.I)
    )
    action_present = usage or implementation
    list_like = bool(re.search(r"[,|•·]", text)) or len(text.split()) <= 8
    claim_only = not action_present and not verification_hits and not github_structure and list_like

    specificity = 0.12
    if usage:
        specificity += 0.25
    if implementation:
        specificity += 0.38
    specificity += min(0.24, artifact_hits * 0.08)
    if re.search(r"\b(using|with|via|through|for|to)\b", text, re.I) and action_present:
        specificity += 0.07
    if verification_hits:
        specificity += 0.08
    if has_number or has_outcome_language:
        specificity += 0.06
    if github_structure:
        specificity = max(specificity, 0.72)
    if claim_only:
        specificity = min(specificity, 0.16)
    specificity = min(1.0, specificity)

    verification = min(1.0, verification_hits * 0.45)
    if verification_hits >= 2:
        verification = min(1.0, verification + 0.1)
    if has_number and has_outcome_language:
        outcome = 1.0
    elif has_number:
        outcome = 0.55
    elif has_outcome_language:
        outcome = 0.4
    else:
        outcome = 0.0

    if claim_only:
        supported_level = 1
    elif professional_context and action_present:
        supported_level = 5
    elif verification_hits:
        supported_level = 4
    elif implementation or github_structure:
        supported_level = 3
    elif usage or artifact_hits:
        supported_level = 2
    else:
        supported_level = 1

    reasons: list[str] = []
    if claim_only:
        reasons.append("Skills-list claim only")
    elif professional_context and action_present:
        reasons.append("Professional context")
    elif implementation or github_structure:
        reasons.append("Implementation detail")
    elif usage:
        reasons.append("Applied use described")
    else:
        reasons.append("Named evidence")
    if verification_hits:
        reasons.append("Test, deployment or validation signal")
    if outcome:
        reasons.append("Outcome signal" if outcome < 1 else "Quantified outcome")
    return EvidenceTextSignals(
        supported_level=supported_level,
        specificity=round(specificity, 3),
        verification=round(verification, 3),
        outcome=round(outcome, 3),
        claim_only=claim_only,
        professional_context=professional_context,
        reasons=tuple(reasons),
    )


def calculate_evidence_strength(
    evidence_level: int,
    confidence: float,
    source_count: int,
    source_type_count: int,
    *,
    specificity: float = 0.35,
    verification: float = 0.0,
    outcome: float = 0.0,
    corroboration_quality: float = 1.0,
) -> EvidenceStrengthResult:
    """Translate auditable evidence into a non-linear 0-100 strength score."""
    level = max(0, min(5, evidence_level))
    confidence = max(0.0, min(1.0, confidence))
    source_count = max(0, source_count)
    source_type_count = max(0, source_type_count)
    specificity = max(0.0, min(1.0, specificity))
    verification = max(0.0, min(1.0, verification))
    outcome = max(0.0, min(1.0, outcome))
    corroboration_quality = max(0.0, min(1.0, corroboration_quality))
    base_score = EVIDENCE_LEVEL_BASE[level]
    if level == 0:
        return EvidenceStrengthResult(
            score=0.0,
            base_score=0.0,
            confidence_adjustment=0.0,
            specificity_bonus=0.0,
            verification_bonus=0.0,
            outcome_bonus=0.0,
            corroboration_bonus=0.0,
            diversity_bonus=0.0,
        )
    confidence_adjustment = max(-2.0, min(2.0, (confidence - 0.75) * 8.0))
    specificity_bonus = (specificity - 0.35) * 5.0
    verification_bonus = verification * 4.0
    outcome_bonus = outcome * 3.5
    corroboration_bonus = (
        min(7.0, 2.5 * log2(source_count)) * corroboration_quality if source_count > 1 else 0.0
    )
    diversity_bonus = 3.0 * corroboration_quality if source_type_count >= 2 else 0.0
    score = min(
        EVIDENCE_LEVEL_CAP[level],
        base_score
        + confidence_adjustment
        + specificity_bonus
        + verification_bonus
        + outcome_bonus
        + corroboration_bonus
        + diversity_bonus,
    )
    return EvidenceStrengthResult(
        score=round(max(0.0, score), 2),
        base_score=round(base_score, 2),
        confidence_adjustment=round(confidence_adjustment, 2),
        specificity_bonus=round(specificity_bonus, 2),
        verification_bonus=round(verification_bonus, 2),
        outcome_bonus=round(outcome_bonus, 2),
        corroboration_bonus=round(corroboration_bonus, 2),
        diversity_bonus=round(diversity_bonus, 2),
    )


def aggregate_evidence_strength(records: Iterable[EvidenceScoreInput]) -> AggregatedEvidenceStrength:
    """Score the strongest independent evidence and use other sources only as corroboration."""
    best_by_source: dict[str, tuple[EvidenceScoreInput, EvidenceTextSignals, EvidenceStrengthResult, int]] = {}
    for record in records:
        signals = assess_evidence_text(record.excerpt, record.source_type, record.locator)
        effective_level = 1 if signals.claim_only else max(record.evidence_level, signals.supported_level)
        standalone = calculate_evidence_strength(
            effective_level,
            record.confidence,
            1,
            1,
            specificity=signals.specificity,
            verification=signals.verification,
            outcome=signals.outcome,
        )
        current = best_by_source.get(record.source_reference)
        if current is None or standalone.score > current[2].score:
            best_by_source[record.source_reference] = (record, signals, standalone, effective_level)

    if not best_by_source:
        empty = calculate_evidence_strength(0, 0, 0, 0)
        return AggregatedEvidenceStrength(0, 0.0, 0, 0, empty, ("No confirmed evidence",))

    ranked = sorted(best_by_source.values(), key=lambda item: item[2].score, reverse=True)
    best_record, best_signals, _, effective_level = ranked[0]
    supporting = ranked[1:]
    corroboration_quality = (
        sum(min(1.0, item[2].score / 80.0) for item in supporting) / len(supporting) if supporting else 0.0
    )
    source_types = {item[0].source_type for item in ranked}
    strength = calculate_evidence_strength(
        effective_level,
        best_record.confidence,
        len(ranked),
        len(source_types),
        specificity=best_signals.specificity,
        verification=best_signals.verification,
        outcome=best_signals.outcome,
        corroboration_quality=corroboration_quality,
    )
    factors = list(best_signals.reasons)
    if len(ranked) > 1:
        factors.append(f"{len(ranked)} independent sources")
    if len(source_types) > 1:
        factors.append("Multiple source types")
    return AggregatedEvidenceStrength(
        evidence_level=effective_level,
        confidence=round(best_record.confidence, 3),
        source_count=len(ranked),
        source_type_count=len(source_types),
        strength=strength,
        score_factors=tuple(factors),
    )


def calculate_job_demand_score(
    mention_count: int,
    importance: str,
    in_title: bool,
) -> JobDemandResult:
    """Score a capability from signals contained in the supplied advert itself."""
    explicit_mention = 30.0 if mention_count > 0 else 0.0
    repetition_signal = min(22.0, 12.0 + 7.0 * log2(max(1, mention_count))) if mention_count else 0.0
    requirement_signal = REQUIREMENT_SIGNALS.get(importance, REQUIREMENT_SIGNALS["named"])
    title_signal = 8.0 if in_title else 0.0
    score = min(100.0, explicit_mention + repetition_signal + requirement_signal + title_signal)
    return JobDemandResult(
        score=round(score, 2),
        explicit_mention=round(explicit_mention, 2),
        repetition_signal=round(repetition_signal, 2),
        requirement_signal=round(requirement_signal, 2),
        title_signal=round(title_signal, 2),
    )


def calculate_dimension_score(request: DimensionScoreRequest) -> ScoreResult:
    """Calculate documented evidence coverage without model-generated numbers."""
    total_weight = sum(item.weight for item in request.evidence)
    covered_weight = sum(item.weight for item in request.evidence if item.evidence_level > 0)
    coverage = covered_weight / total_weight * 100

    contributions: list[dict[str, str | float]] = []
    weighted_depth = 0.0
    for item in request.evidence:
        normalized = (
            item.evidence_level
            / 5
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
