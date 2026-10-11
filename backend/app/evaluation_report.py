import argparse
import json
from pathlib import Path

from .extraction import suggest_evidence
from .role_decoder import decode_role


def _cases(name: str) -> list[dict]:
    path = Path(__file__).parents[1] / "evaluation" / name
    if not path.exists():
        path = Path.cwd() / "evaluation" / name
    return json.loads(path.read_text(encoding="utf-8"))


def build_report() -> dict[str, float | int]:
    jd_cases = _cases("jd_extraction.json")
    cv_cases = _cases("cv_evidence.json")

    role_checks = 0
    role_passes = 0
    scope_passes = 0
    expected_jd_skills = 0
    recalled_jd_skills = 0
    eligibility_checks = 0
    eligibility_passes = 0

    for case in jd_cases:
        result = decode_role(case["title"], case["description"])
        expected_role = case.get("expected_role")
        if expected_role:
            role_checks += 1
            actual_role = "out-of-scope" if result.role_label == "Outside current role taxonomy" else result.role_family
            role_passes += int(actual_role == expected_role)
        scope_passes += int(result.scope_status == case["expected_scope"])
        actual_skills = {item.slug for item in result.skill_signals}
        expected_skills = set(case.get("expected_skills", []))
        expected_jd_skills += len(expected_skills)
        recalled_jd_skills += len(expected_skills & actual_skills)
        expected_eligibility = set(case.get("expected_eligibility", []))
        actual_eligibility = {item.category for item in result.eligibility_requirements}
        eligibility_checks += len(expected_eligibility)
        eligibility_passes += len(expected_eligibility & actual_eligibility)

    expected_cv_skills = 0
    recalled_cv_skills = 0
    level_checks = 0
    level_passes = 0
    for case in cv_cases:
        suggestions = {item.skill: item for item in suggest_evidence(case["text"])}
        expected_skills = set(case.get("expected_skills", []))
        expected_cv_skills += len(expected_skills)
        recalled_cv_skills += len(expected_skills & suggestions.keys())
        for skill, minimum in case.get("minimum_levels", {}).items():
            level_checks += 1
            level_passes += int(skill in suggestions and suggestions[skill].proposed_level >= minimum)
        if "maximum_level" in case:
            level_checks += 1
            level_passes += int(all(item.proposed_level <= case["maximum_level"] for item in suggestions.values()))
        for skill, maximum in case.get("forbidden_above_level", {}).items():
            level_checks += 1
            level_passes += int(skill not in suggestions or suggestions[skill].proposed_level <= maximum)

    return {
        "jd_case_count": len(jd_cases),
        "jd_role_accuracy": round(role_passes / max(role_checks, 1), 4),
        "jd_scope_accuracy": round(scope_passes / max(len(jd_cases), 1), 4),
        "jd_expected_skill_recall": round(recalled_jd_skills / max(expected_jd_skills, 1), 4),
        "jd_eligibility_recall": round(eligibility_passes / max(eligibility_checks, 1), 4),
        "cv_case_count": len(cv_cases),
        "cv_expected_skill_recall": round(recalled_cv_skills / max(expected_cv_skills, 1), 4),
        "cv_evidence_level_constraint_accuracy": round(level_passes / max(level_checks, 1), 4),
    }


def main() -> None:
    parser = argparse.ArgumentParser(description="Run deterministic CareerSignal labelled-set evaluation.")
    parser.add_argument("--minimum", type=float, default=0.0, help="Fail if any metric is below this value.")
    args = parser.parse_args()
    report = build_report()
    print(json.dumps(report, indent=2, sort_keys=True))
    metrics = [value for key, value in report.items() if key.endswith(("accuracy", "recall"))]
    if any(value < args.minimum for value in metrics):
        raise SystemExit(f"One or more evaluation metrics fell below {args.minimum:.2f}")


if __name__ == "__main__":
    main()
