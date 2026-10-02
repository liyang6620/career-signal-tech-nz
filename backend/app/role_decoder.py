import html
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

TITLE_ROLE_PATTERNS = {
    "software": (r"\bsoftware engineer\b", r"\b(?:front[- ]?end|back[- ]?end|full[- ]?stack) developer\b"),
    "data-analyst": (
        r"\bdata (?:&|and )?systems? analyst\b",
        r"\bdata analyst\b",
        r"\bbi analyst\b",
        r"\bsystems analyst\b",
    ),
    "data-engineer": (r"\bdata engineer(?:ing)?\b", r"\banalytics engineer\b", r"\betl developer\b"),
    "ai": (
        r"\b(?:ai|ml)(?: application| platform)? engineer\b",
        r"\bmachine learning engineer\b",
        r"\bai application engineer\b",
    ),
    "cloud-devops": (
        r"\bdevops engineer\b",
        r"\bcloud engineer\b",
        r"\bplatform engineer\b",
        r"\bsite reliability engineer\b",
    ),
}

ROLE_SIGNAL_BONUSES = {
    "software": {"ruby-on-rails": 16},
    "data-analyst": {
        "excel": 10, "ms-access": 7, "systems-analysis": 12, "data-quality": 10,
        "analytical-reasoning": 8, "root-cause-analysis": 7, "problem-solving": 5,
        "attention-to-detail": 4, "geospatial-data": 4,
    },
    "data-engineer": {
        "etl": 15, "big-data": 9, "geospatial-data": 7, "data-quality": 8,
        "systems-analysis": 5,
    },
    "ai": {"data-quality": 5, "analytical-reasoning": 4, "problem-solving": 4},
    "cloud-devops": {"systems-analysis": 5, "root-cause-analysis": 5, "problem-solving": 4},
}


@dataclass(frozen=True)
class DecodedSkillSignal:
    slug: str
    name: str
    mention_count: int
    importance: str
    in_title: bool


@dataclass(frozen=True)
class EligibilityRequirement:
    category: str
    label: str
    importance: str
    excerpt: str


@dataclass(frozen=True)
class DecodedRole:
    role_family: str
    role_label: str
    confidence: float
    seniority: str
    matched_skills: list[tuple[str, str, int]]
    skill_signals: list[DecodedSkillSignal]
    role_matches: list[tuple[str, float]]
    scope_status: str
    taxonomy_coverage: float
    unmapped_skills: list[str]
    eligibility_requirements: list[EligibilityRequirement]
    alternatives: list[tuple[str, float]]


IMPORTANCE_PATTERNS = {
    "essential": (
        r"\bmust\b", r"\brequired\b", r"\bstrong\b", r"\bproficien(?:cy|t)\b",
        r"\bsolid understanding\b", r"\bworking knowledge\b", r"\bexperience building\b",
        r"\bexperience using\b", r"\brole focuses? on\b",
    ),
    "supporting": (
        r"\bbonus\b", r"\bexposure\b", r"\binterest in\b", r"\bfamiliarity\b",
        r"\buseful\b", r"\bideally\b", r"\bpreferred\b",
    ),
}

ELIGIBILITY_PATTERNS = (
    (
        "citizenship",
        "Citizenship or residency",
        (
            r"\b(?:new zealand|nz) citizen(?:s|ship)?\b",
            r"\b(?:new zealand|nz) permanent residen(?:t|cy)\b",
            r"\b(?:citizens?|permanent residents?) of new zealand\b",
        ),
    ),
    (
        "work-authorisation",
        "New Zealand work rights",
        (
            r"\b(?:right|rights|eligibility|eligible|entitled|authori[sz](?:ed|ation)) to work in (?:new zealand|nz)\b",
            r"\bvalid (?:new zealand|nz)?\s*work visa\b",
            r"\b(?:new zealand|nz) work rights?\b",
        ),
    ),
    (
        "security-clearance",
        "Security clearance",
        (
            r"\b(?:national |government )?security clearance\b",
            r"\b(?:obtain|hold|maintain) (?:a |an )?(?:confidential|secret|top secret) clearance\b",
        ),
    ),
    (
        "background-screening",
        "Background screening",
        (
            r"\bpolice (?:check|vetting|clearance)\b",
            r"\bcriminal (?:record |history )?check\b",
            r"\bbackground (?:check|screening)\b",
        ),
    ),
    (
        "driver-licence",
        "Driver licence",
        (
            r"\b(?:(?:full|current|valid|clean) )?(?:(?:new zealand|nz) )?driver'?s? licen[cs]e\b",
        ),
    ),
    (
        "qualification",
        "Formal qualification",
        (
            r"\b(?:bachelor'?s|master'?s|doctoral|phd) degree\b",
            r"\b(?:relevant |recognised |recognized )?(?:tertiary|professional) qualification\b",
            r"\bprofessional registration\b",
        ),
    ),
    (
        "location",
        "Location or on-site attendance",
        (
            r"\b(?:must|required to|expected to) (?:be )?(?:based|located|work|attend|relocate)\b[^.!?\n]{0,100}",
            r"\b(?:fully )?on[- ]site (?:role|position|work)\b",
        ),
    ),
    (
        "travel",
        "Travel availability",
        (
            r"\b(?:must|required to|expected to) (?:be )?(?:travel|available to travel)\b[^.!?\n]{0,100}",
        ),
    ),
    (
        "pre-employment-screening",
        "Pre-employment screening",
        (
            r"\b(?:pre[- ]employment )?(?:drug(?: and alcohol)?|medical) (?:test|screening|assessment)\b",
        ),
    ),
)

REQUIRED_ELIGIBILITY_PATTERNS = (
    r"\bmust\b", r"\brequired\b", r"\bmandatory\b", r"\bessential\b",
    r"\bonly (?:open|available) to\b", r"\bcondition of employment\b",
    r"\bneed(?:ed)? to\b", r"\bneeds? to\b", r"\bwe require\b",
    r"\b(?:be )?eligible to\b", r"\b(?:be )?able to obtain\b",
)
PREFERRED_ELIGIBILITY_PATTERNS = (
    r"\bpreferred\b", r"\bdesirable\b", r"\bideally\b", r"\ban advantage\b",
    r"\bnice to have\b",
)
DEFAULT_REQUIRED_CATEGORIES = {
    "citizenship", "work-authorisation", "security-clearance",
    "background-screening", "pre-employment-screening",
}


def _mention_spans(text: str, patterns: tuple[str, ...]) -> list[tuple[int, int]]:
    spans = sorted(
        (match.start(), match.end())
        for pattern in patterns
        for match in re.finditer(pattern, text, re.I)
    )
    merged: list[tuple[int, int]] = []
    for start, end in spans:
        if merged and start < merged[-1][1]:
            merged[-1] = (merged[-1][0], max(merged[-1][1], end))
        else:
            merged.append((start, end))
    return merged


def _skill_importance(text: str, patterns: tuple[str, ...]) -> str:
    importance = "named"
    section_importance = "named"
    essential_sections = (
        r"key to your success", r"required skills", r"requirements", r"must have",
        r"what (?:you(?:'|’)ll|you will) (?:bring|need)", r"demonstrate the following skills",
    )
    supporting_sections = (
        r"ideal applicant", r"nice to have", r"preferred", r"desirable", r"an advantage",
    )
    for raw_line in text.splitlines():
        segment = re.sub(r"^[\s•*#\-–—]+|[\s*#]+$", "", raw_line).strip()
        if not segment:
            continue
        is_list_item = bool(re.match(r"^\s*(?:[-–—•]|\d+[.)])\s+", raw_line))
        looks_like_heading = "**" in raw_line or segment.endswith(":") or (
            not is_list_item and len(segment) < 90 and not re.search(r"[.!?]$", segment)
        )
        if looks_like_heading:
            if any(re.search(pattern, segment, re.I) for pattern in essential_sections):
                section_importance = "essential"
            elif any(re.search(pattern, segment, re.I) for pattern in supporting_sections):
                section_importance = "supporting"
            elif not _mention_spans(segment, patterns):
                section_importance = "named"
        for clause in re.split(r"(?<=[.!?])\s+", segment):
            if not _mention_spans(clause, patterns):
                continue
            if any(re.search(pattern, clause, re.I) for pattern in IMPORTANCE_PATTERNS["essential"]):
                return "essential"
            if any(re.search(pattern, clause, re.I) for pattern in IMPORTANCE_PATTERNS["supporting"]):
                importance = "supporting"
            elif section_importance == "essential":
                return "essential"
            elif section_importance == "supporting":
                importance = "supporting"
    return importance


def _normalise_job_text(value: str) -> str:
    value = html.unescape(value).replace("\xa0", " ")
    value = re.sub(r"<[^>]+>", " ", value)
    return re.sub(r"[ \t]+", " ", value)


def _eligibility_requirements(description: str) -> list[EligibilityRequirement]:
    segments = [
        re.sub(r"^[\s•*\-–—]+", "", segment).strip()
        for segment in re.split(r"(?<=[.!?])\s+|[\r\n]+", description)
        if segment.strip()
    ]
    requirements: list[EligibilityRequirement] = []
    seen: set[tuple[str, str]] = set()
    for segment in segments:
        for category, label, patterns in ELIGIBILITY_PATTERNS:
            if not any(re.search(pattern, segment, re.I) for pattern in patterns):
                continue
            if any(re.search(pattern, segment, re.I) for pattern in PREFERRED_ELIGIBILITY_PATTERNS):
                importance = "preferred"
            elif category in DEFAULT_REQUIRED_CATEGORIES or any(
                re.search(pattern, segment, re.I) for pattern in REQUIRED_ELIGIBILITY_PATTERNS
            ):
                importance = "required"
            else:
                importance = "stated"
            excerpt = re.sub(r"\s+", " ", segment).strip()[:360]
            key = (category, excerpt.lower())
            if key not in seen:
                requirements.append(EligibilityRequirement(category, label, importance, excerpt))
                seen.add(key)
    order = {"required": 0, "stated": 1, "preferred": 2}
    return sorted(requirements, key=lambda item: (order[item.importance], item.label))


def decode_role(title: str, description: str) -> DecodedRole:
    title = _normalise_job_text(title)
    description = _normalise_job_text(description)
    text = f"{title}\n{description}"
    skill_counts = {
        slug: len(_mention_spans(text, patterns))
        for slug, (_, _, patterns) in SKILLS.items()
    }
    skill_counts = {slug: count for slug, count in skill_counts.items() if count}
    scores = {}
    for role, requirements in ROLE_REQUIREMENTS.items():
        total_weight = sum(weight for _, weight, _ in requirements)
        matched_weight = sum(weight for slug, weight, _ in requirements if skill_counts.get(slug, 0))
        base_score = matched_weight / total_weight * 100
        title_bonus = 28 if any(re.search(pattern, title, re.I) for pattern in TITLE_ROLE_PATTERNS[role]) else 0
        signal_bonus = sum(
            bonus for slug, bonus in ROLE_SIGNAL_BONUSES.get(role, {}).items() if skill_counts.get(slug, 0)
        )
        scores[role] = min(100, base_score + title_bonus + signal_bonus)
    ordered = sorted(scores.items(), key=lambda item: item[1], reverse=True)
    best_role, best_score = ordered[0]
    second_role, second_score = ordered[1]
    confidence = best_score / 100
    seniority = "intermediate"
    for label, patterns in SENIORITY_PATTERNS.items():
        if any(re.search(pattern, text, re.I) for pattern in patterns):
            seniority = label
            break
    all_role_skills = {
        slug for requirements in ROLE_REQUIREMENTS.values() for slug, _, _ in requirements
    } | {slug for bonuses in ROLE_SIGNAL_BONUSES.values() for slug in bonuses}
    mapped_count = sum(1 for slug in skill_counts if slug in all_role_skills)
    taxonomy_coverage = mapped_count / len(skill_counts) * 100 if skill_counts else 0
    if best_score < 25:
        scope_status = "out_of_scope"
        role_label = "Outside current role taxonomy"
    elif second_score >= 35 and best_score - second_score <= 15:
        scope_status = "mixed"
        role_label = f"Mixed: {ROLE_LABELS[best_role]} + {ROLE_LABELS[second_role]}"
    elif taxonomy_coverage < 60:
        scope_status = "adjacent"
        role_label = ROLE_LABELS[best_role]
    else:
        scope_status = "matched"
        role_label = ROLE_LABELS[best_role]
    skill_signals = [
        DecodedSkillSignal(
            slug=slug,
            name=SKILLS[slug][0],
            mention_count=count,
            importance=_skill_importance(text, SKILLS[slug][2]),
            in_title=bool(_mention_spans(title, SKILLS[slug][2])),
        )
        for slug, count in skill_counts.items()
    ]
    return DecodedRole(
        role_family=best_role,
        role_label=role_label,
        confidence=round(confidence, 3),
        seniority=seniority,
        matched_skills=[(slug, SKILLS[slug][0], count) for slug, count in skill_counts.items()],
        skill_signals=skill_signals,
        role_matches=[(role, round(score, 1)) for role, score in ordered],
        scope_status=scope_status,
        taxonomy_coverage=round(taxonomy_coverage, 1),
        unmapped_skills=[signal.name for signal in skill_signals if signal.slug not in all_role_skills],
        eligibility_requirements=_eligibility_requirements(description),
        alternatives=[(role, round(score / 100, 3)) for role, score in ordered[1:3]],
    )
