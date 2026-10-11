import json
from collections import defaultdict

from sqlalchemy import select
from sqlalchemy.orm import Session

from ..models import CandidateSkillEvidence, JobAnalysis, User
from ..role_decoder import ROLE_LABELS, ROLE_SIGNAL_BONUSES, decode_role
from ..schemas import RoleDecodeRequest, RoleDecodeResponse
from ..scoring import EvidenceScoreInput, aggregate_evidence_strength, calculate_job_demand_score
from ..security_events import audit
from ..taxonomy import ROLE_REQUIREMENTS


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


def analyse_role(payload: RoleDecodeRequest, user: User, db: Session) -> RoleDecodeResponse:
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
