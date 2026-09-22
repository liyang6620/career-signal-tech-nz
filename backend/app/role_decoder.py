import re
from dataclasses import dataclass

from .taxonomy import ROLE_REQUIREMENTS, SKILLS

ROLE_LABELS = {
    "software": "Software Engineering",
    "data-analyst": "Data & BI Analytics",
    "data-engineer": "Data Engineering",
    "ai": "AI Application Engineering",
    "cloud-devops": "Cloud & DevOps",
}

SENIORITY_PATTERNS = {
    "graduate": (r"\bgraduate\b", r"\bintern(?:ship)?\b", r"entry[- ]level"),
    "junior": (r"\bjunior\b", r"\bjunior-level\b", r"\b1[-– ]2 years?\b"),
    "senior": (r"\bsenior\b", r"\blead\b", r"\bprincipal\b", r"\b5\+ years?\b"),
}


@dataclass(frozen=True)
class DecodedRole:
    role_family: str
    role_label: str
    confidence: float
    seniority: str
    matched_skills: list[tuple[str, str, int]]
    alternatives: list[tuple[str, float]]


def decode_role(title: str, description: str) -> DecodedRole:
    text = f"{title}\n{description}"
    skill_counts = {
        slug: sum(len(re.findall(pattern, text, re.I)) for pattern in patterns)
        for slug, (_, _, patterns) in SKILLS.items()
    }
    skill_counts = {slug: count for slug, count in skill_counts.items() if count}
    scores = {
        role: sum(weight * min(skill_counts.get(slug, 0), 2) for slug, weight, _ in requirements)
        for role, requirements in ROLE_REQUIREMENTS.items()
    }
    ordered = sorted(scores.items(), key=lambda item: item[1], reverse=True)
    best_role, best_score = ordered[0]
    total = sum(scores.values()) or 1
    confidence = min(0.95, 0.45 + best_score / total * 0.5) if best_score else 0.2
    seniority = "intermediate"
    for label, patterns in SENIORITY_PATTERNS.items():
        if any(re.search(pattern, text, re.I) for pattern in patterns):
            seniority = label
            break
    return DecodedRole(
        role_family=best_role,
        role_label=ROLE_LABELS[best_role],
        confidence=round(confidence, 3),
        seniority=seniority,
        matched_skills=[(slug, SKILLS[slug][0], count) for slug, count in skill_counts.items()],
        alternatives=[(role, round(score / total, 3)) for role, score in ordered[1:3]],
    )
