import hashlib
import re
from dataclasses import dataclass
from pathlib import Path

from docx import Document
from pypdf import PdfReader

from .scoring import assess_evidence_text
from .taxonomy import SKILLS

PARSER_VERSION = "local-taxonomy-v4"

SECTION_NAMES = {
    "experience": "Experience",
    "work experience": "Experience",
    "professional experience": "Experience",
    "employment history": "Experience",
    "internship": "Internship",
    "internships": "Internship",
    "projects": "Projects",
    "project experience": "Projects",
    "selected projects": "Projects",
    "key projects": "Projects",
    "skills": "Skills",
    "technical skills": "Skills",
    "technical competencies": "Skills",
    "technologies": "Skills",
    "professional summary": "Summary",
    "profile": "Summary",
    "education": "Education",
    "coursework": "Coursework",
    "certifications": "Certifications",
}

BULLET_PATTERN = re.compile(r"^[\s•●⚫▪◦*-]+")


def _heading_name(line: str) -> str | None:
    heading = re.sub(r"[^a-z ]", "", line.casefold()).strip()
    if heading in SECTION_NAMES and len(line.split()) <= 4:
        return SECTION_NAMES[heading]
    return None


def _evidence_excerpt(lines: list[str], sections: list[str], index: int) -> str:
    """Join wrapped CV bullets and project descriptions without crossing into another item."""
    line = lines[index]
    is_project_title = sections[index] == "Projects" and bool(
        re.search(r"(?:\||·).*(?:19|20)\d{2}\b", line)
    )
    if not BULLET_PATTERN.match(line) and not is_project_title:
        return line[:400]
    context = [line]
    for following in lines[index + 1:index + 5]:
        if _heading_name(following) is not None or BULLET_PATTERN.match(following):
            break
        if is_project_title and re.fullmatch(r"key achievements?:?", following.strip(), re.I):
            break
        context.append(following)
        if len(" ".join(context)) >= 400:
            break
    return " ".join(context)[:400]


def _skill_focused_excerpt(skill: str, excerpt: str) -> str:
    if skill == "Git" and re.search(r"(?:[.|]\s*)GitHub\s*$", excerpt, re.I) and not re.search(
        r"\b(git\s+(?:branch|commit|merge|workflow|version control)|github actions|pull requests?)\b",
        excerpt,
        re.I,
    ):
        return "GitHub project link"
    return excerpt

@dataclass(frozen=True)
class ParsedDocument:
    text: str
    text_sha256: str
    character_count: int
    page_count: int | None


@dataclass(frozen=True)
class SuggestedEvidence:
    skill: str
    category: str
    excerpt: str
    locator: str
    confidence: float
    proposed_level: int


def parse_document(path: Path, content_type: str) -> ParsedDocument:
    if content_type == "application/pdf":
        reader = PdfReader(path)
        pages = [(page.extract_text() or "").strip() for page in reader.pages]
        text = "\n".join(page for page in pages if page)
        page_count = len(reader.pages)
    elif content_type == "application/vnd.openxmlformats-officedocument.wordprocessingml.document":
        document = Document(path)
        blocks = [paragraph.text.strip() for paragraph in document.paragraphs if paragraph.text.strip()]
        # CV templates frequently put technical skills and project details in
        # tables. Reading only paragraphs silently drops those cells.
        for table in document.tables:
            for row in table.rows:
                cells = [cell.text.strip() for cell in row.cells if cell.text.strip()]
                if cells:
                    blocks.append(" | ".join(cells))
        text = "\n".join(blocks)
        page_count = None
    else:
        raise ValueError("Unsupported document type")
    normalized = re.sub(r"[ \t]+", " ", text).strip()
    if len(normalized) < 20:
        raise ValueError("Document contains too little extractable text")
    return ParsedDocument(
        text=normalized,
        text_sha256=hashlib.sha256(normalized.encode("utf-8")).hexdigest(),
        character_count=len(normalized),
        page_count=page_count,
    )


def suggest_evidence(text: str) -> list[SuggestedEvidence]:
    lines = [line.strip() for line in text.splitlines() if line.strip()]
    sections: list[str] = []
    current_section = "Document"
    for line in lines:
        heading = _heading_name(line)
        if heading is not None:
            current_section = heading
        sections.append(current_section)

    suggestions: list[SuggestedEvidence] = []
    for _, (skill, category, patterns) in SKILLS.items():
        matches = [
            (index, line)
            for index, line in enumerate(lines)
            if any(re.search(pattern, line, re.I) for pattern in patterns)
        ]
        if not matches:
            continue
        candidates = []
        for index, _line in matches:
            locator = f"{sections[index]}, line {index + 1}"
            excerpt = _skill_focused_excerpt(skill, _evidence_excerpt(lines, sections, index))
            signals = assess_evidence_text(excerpt, "cv", locator)
            confidence = 0.58 + signals.specificity * 0.24
            confidence += signals.verification * 0.06 + signals.outcome * 0.05
            if signals.professional_context:
                confidence += 0.04
            if len(matches) > 1:
                confidence += min(0.04, 0.015 * (len(matches) - 1))
            confidence = round(min(0.97, confidence), 3)
            candidates.append((signals.supported_level, confidence, signals.specificity, index, excerpt, locator))
        level, confidence, _, _, excerpt, locator = max(
            candidates,
            key=lambda item: (item[0], item[1], item[2], len(item[4])),
        )
        suggestions.append(
            SuggestedEvidence(
                skill=skill,
                category=category,
                excerpt=excerpt,
                locator=locator,
                confidence=confidence,
                proposed_level=level,
            )
        )
    return suggestions
