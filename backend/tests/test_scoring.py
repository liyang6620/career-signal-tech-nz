from app.schemas import DimensionScoreRequest
from app.scoring import calculate_dimension_score


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
