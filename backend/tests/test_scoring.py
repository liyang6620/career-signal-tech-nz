from app.schemas import DimensionScoreRequest
from app.scoring import (
    EvidenceScoreInput,
    aggregate_evidence_strength,
    assess_evidence_text,
    calculate_dimension_score,
    calculate_evidence_strength,
    calculate_job_demand_score,
)


def test_evidence_strength_is_non_linear_and_rewards_corroboration() -> None:
    claimed = calculate_evidence_strength(1, 0.8, 1, 1)
    used = calculate_evidence_strength(2, 0.8, 1, 1)
    corroborated = calculate_evidence_strength(3, 0.9, 4, 2)

    assert claimed.score == 34.4
    assert used.score == 59.4
    assert corroborated.score == 84.2
    assert corroborated.corroboration_bonus == 5
    assert corroborated.diversity_bonus == 3


def test_project_use_is_credible_mid_level_evidence() -> None:
    result = calculate_evidence_strength(2, 0.75, 1, 1)
    assert 55 <= result.score < 75


def test_no_evidence_always_scores_zero() -> None:
    result = calculate_evidence_strength(0, 1, 5, 3)
    assert result.score == 0


def test_evidence_text_signals_follow_the_maturity_standard() -> None:
    claimed = assess_evidence_text("SQL, Python, Power BI", "cv", "Skills, line 4")
    used = assess_evidence_text("Used SQL to analyse customer orders", "cv", "Projects, line 10")
    implemented = assess_evidence_text("Built a SQL data model and reporting dashboard", "cv", "Projects, line 12")
    verified = assess_evidence_text(
        "Built a Python API with integration tests and deployed it to production",
        "cv",
        "Projects, line 14",
    )
    professional = assess_evidence_text(
        "Automated a Power BI reporting workflow for the sales team",
        "cv",
        "Experience, line 18",
    )

    assert claimed.supported_level == 1
    assert used.supported_level == 2
    assert implemented.supported_level == 3
    assert verified.supported_level == 4
    assert professional.supported_level == 5


def test_same_recorded_level_can_score_differently_when_evidence_quality_differs() -> None:
    generic = aggregate_evidence_strength([
        EvidenceScoreInput(2, 0.75, "Used Python", "Projects, line 4", "cv", "cv:one")
    ])
    concrete = aggregate_evidence_strength([
        EvidenceScoreInput(
            2,
            0.75,
            "Used Python to analyse 20,000 records and improved reporting accuracy by 18%",
            "Projects, line 8",
            "cv",
            "cv:two",
        )
    ])

    assert concrete.strength.score > generic.strength.score
    assert concrete.strength.outcome_bonus > generic.strength.outcome_bonus


def test_identical_evidence_remains_deterministic() -> None:
    record = EvidenceScoreInput(2, 0.75, "Used SQL to query a customer dataset", "Projects, line 4", "cv", "cv:one")
    assert aggregate_evidence_strength([record]) == aggregate_evidence_strength([record])


def test_duplicate_records_from_one_source_do_not_count_as_corroboration() -> None:
    records = [
        EvidenceScoreInput(2, 0.75, "Used SQL for reporting", "Projects, line 4", "cv", "cv:one"),
        EvidenceScoreInput(3, 0.82, "Built SQL queries for a dashboard", "Projects, line 8", "cv", "cv:one"),
    ]
    result = aggregate_evidence_strength(records)
    assert result.source_count == 1
    assert result.strength.corroboration_bonus == 0


def test_multiple_weak_claims_cannot_reach_implementation_maturity() -> None:
    records = [
        EvidenceScoreInput(2, 0.75, "SQL, Python", "Skills, line 3", "cv", "cv:one"),
        EvidenceScoreInput(2, 0.75, "SQL | Tableau", "Skills, line 4", "portfolio", "portfolio:one"),
        EvidenceScoreInput(2, 0.75, "SQL", "Skills, line 5", "cv", "cv:two"),
    ]
    result = aggregate_evidence_strength(records)
    assert result.evidence_level == 1
    assert result.strength.score < 45


def test_job_demand_separates_core_and_contextual_skills() -> None:
    core = calculate_job_demand_score(2, "essential", False)
    contextual = calculate_job_demand_score(1, "supporting", False)

    assert core.score == 84
    assert contextual.score == 50
    assert core.requirement_signal == 35
    assert contextual.requirement_signal == 8


def test_title_context_increases_jd_priority() -> None:
    body_only = calculate_job_demand_score(1, "named", False)
    title_skill = calculate_job_demand_score(1, "named", True)
    assert title_skill.score - body_only.score == 8


def test_score_is_deterministic_and_explainable() -> None:
    payload = DimensionScoreRequest.model_validate(
        {
            "target_role": "Data Engineer",
            "seniority": "junior",
            "evidence": [
                {
                    "skill": "SQL",
                    "evidence_level": 5,
                    "quality_factor": 1,
                    "recency_factor": 1,
                    "verification_factor": 1,
                    "role_relevance": 1,
                    "weight": 2,
                },
                {
                    "skill": "dbt",
                    "evidence_level": 0,
                    "quality_factor": 1,
                    "recency_factor": 1,
                    "verification_factor": 1,
                    "role_relevance": 1,
                    "weight": 1,
                },
            ],
        }
    )
    result = calculate_dimension_score(payload)
    assert result.coverage == 66.67
    assert result.evidence_depth == 66.67
    assert result.score == 66.67
    assert result.contributions[0]["normalized_score"] == 100


def test_missing_required_skill_caps_score() -> None:
    payload = DimensionScoreRequest.model_validate(
        {
            "target_role": "AI Application Engineer",
            "seniority": "junior",
            "evidence": [
                {
                    "skill": "Python",
                    "evidence_level": 5,
                    "quality_factor": 1,
                    "recency_factor": 1,
                    "verification_factor": 1,
                    "role_relevance": 1,
                    "weight": 9,
                },
                {
                    "skill": "Evaluation",
                    "evidence_level": 0,
                    "quality_factor": 1,
                    "recency_factor": 1,
                    "verification_factor": 1,
                    "role_relevance": 1,
                    "weight": 1,
                    "required": True,
                },
            ],
        }
    )
    result = calculate_dimension_score(payload)
    assert result.cap_applied is True
    assert result.score == 59
