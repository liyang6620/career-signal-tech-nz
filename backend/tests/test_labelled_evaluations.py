import json
from pathlib import Path

from app.extraction import suggest_evidence
from app.role_decoder import decode_role

EVALUATION_DIR = Path(__file__).parents[1] / "evaluation"


def load_cases(name: str) -> list[dict]:
    return json.loads((EVALUATION_DIR / name).read_text(encoding="utf-8"))


def test_labelled_jd_extraction_cases() -> None:
    for case in load_cases("jd_extraction.json"):
        decoded = decode_role(case["title"], case["description"])
        skills = {item.slug for item in decoded.skill_signals}
        assert set(case["expected_skills"]) <= skills, case["id"]
        assert decoded.scope_status == case["expected_scope"], case["id"]
        if case.get("expected_role") == "out-of-scope":
            assert decoded.role_label == "Outside current role taxonomy", case["id"]
        elif case.get("expected_role"):
            assert decoded.role_family == case["expected_role"], case["id"]
        expected_eligibility = set(case.get("expected_eligibility", []))
        actual_eligibility = {item.category for item in decoded.eligibility_requirements}
        assert expected_eligibility <= actual_eligibility, case["id"]


def test_labelled_cv_evidence_cases() -> None:
    for case in load_cases("cv_evidence.json"):
        suggestions = {item.skill: item for item in suggest_evidence(case["text"])}
        assert set(case["expected_skills"]) <= suggestions.keys(), case["id"]
        for skill, minimum in case.get("minimum_levels", {}).items():
            assert suggestions[skill].proposed_level >= minimum, case["id"]
        if "maximum_level" in case:
            assert all(item.proposed_level <= case["maximum_level"] for item in suggestions.values()), case["id"]
        for skill, maximum in case.get("forbidden_above_level", {}).items():
            if skill in suggestions:
                assert suggestions[skill].proposed_level <= maximum, case["id"]
