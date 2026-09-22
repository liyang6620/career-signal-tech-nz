import hashlib
import re
from dataclasses import dataclass
from pathlib import Path

from docx import Document
from pypdf import PdfReader

PARSER_VERSION = "local-taxonomy-v1"

SKILLS: dict[str, tuple[str, tuple[str, ...]]] = {
    "Python": ("Programming", (r"\bpython\b",)),
    "JavaScript": ("Programming", (r"\bjavascript\b", r"\bjs\b")),
    "TypeScript": ("Programming", (r"\btypescript\b",)),
    "Java": ("Programming", (r"\bjava\b",)),
    "C#": ("Programming", (r"(?<!\w)c#(?!\w)", r"\b\.net\b")),
    "React": ("Frontend", (r"\breact(?:\.js)?\b",)),
    "Node.js": ("Backend", (r"\bnode(?:\.js)?\b",)),
    "FastAPI": ("Backend", (r"\bfastapi\b",)),
    "SQL": ("Data", (r"\bsql\b",)),
    "PostgreSQL": ("Data", (r"\bpostgres(?:ql)?\b",)),
    "Power BI": ("Analytics", (r"\bpower\s*bi\b",)),
    "Tableau": ("Analytics", (r"\btableau\b",)),
    "dbt": ("Data Engineering", (r"\bdbt\b",)),
    "Apache Spark": ("Data Engineering", (r"\b(?:apache\s+)?spark\b",)),
    "Airflow": ("Data Engineering", (r"\bairflow\b",)),
    "Docker": ("Cloud & DevOps", (r"\bdocker\b",)),
    "Kubernetes": ("Cloud & DevOps", (r"\bkubernetes\b", r"\bk8s\b")),
    "AWS": ("Cloud & DevOps", (r"\baws\b", r"amazon web services")),
    "Azure": ("Cloud & DevOps", (r"\bazure\b",)),
    "Google Cloud": ("Cloud & DevOps", (r"\bgcp\b", r"google cloud")),
    "Terraform": ("Cloud & DevOps", (r"\bterraform\b",)),
    "GitHub Actions": ("Delivery", (r"github actions",)),
    "CI/CD": ("Delivery", (r"\bci\s*/\s*cd\b", r"continuous integration")),
    "Machine Learning": ("AI & ML", (r"machine learning", r"\bml\b")),
    "Large Language Models": ("AI & ML", (r"large language model", r"\bllms?\b")),
    "RAG": ("AI & ML", (r"\brag\b", r"retrieval[- ]augmented generation")),
    "Automated Testing": ("Quality", (r"automated testing", r"test automation", r"\bpytest\b", r"\bplaywright\b")),
    "REST APIs": ("Software Engineering", (r"\brest(?:ful)?\s+apis?\b",)),
    "Git": ("Software Engineering", (r"\bgit\b", r"\bgithub\b", r"\bgitlab\b")),
    "Agile": ("Delivery", (r"\bagile\b", r"\bscrum\b")),
}


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
        text = "\n".join(paragraph.text.strip() for paragraph in document.paragraphs if paragraph.text.strip())
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
    suggestions: list[SuggestedEvidence] = []
    for skill, (category, patterns) in SKILLS.items():
        match_line = next((line for line in lines if any(re.search(pattern, line, re.I) for pattern in patterns)), None)
        if match_line is None:
            continue
        excerpt = match_line[:400]
        action_pattern = r"\b(built|developed|implemented|deployed|designed|created|automated|integrated)\b"
        implementation_signal = bool(re.search(action_pattern, excerpt, re.I))
        suggestions.append(
            SuggestedEvidence(
                skill=skill,
                category=category,
                excerpt=excerpt,
                locator=f"line {lines.index(match_line) + 1}",
                confidence=0.9 if implementation_signal else 0.75,
                proposed_level=3 if implementation_signal else 2,
            )
        )
    return suggestions
