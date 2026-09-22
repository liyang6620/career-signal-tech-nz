SKILLS: dict[str, tuple[str, str, tuple[str, ...]]] = {
    "python": ("Python", "Programming", (r"\bpython\b",)),
    "javascript": ("JavaScript", "Programming", (r"\bjavascript\b", r"\bjs\b")),
    "typescript": ("TypeScript", "Programming", (r"\btypescript\b",)),
    "java": ("Java", "Programming", (r"\bjava\b",)),
    "c-sharp": ("C#", "Programming", (r"(?<!\w)c#(?!\w)", r"\b\.net\b")),
    "react": ("React", "Frontend", (r"\breact(?:\.js)?\b",)),
    "node-js": ("Node.js", "Backend", (r"\bnode(?:\.js)?\b",)),
    "fastapi": ("FastAPI", "Backend", (r"\bfastapi\b",)),
    "sql": ("SQL", "Data", (r"\bsql\b",)),
    "postgresql": ("PostgreSQL", "Data", (r"\bpostgres(?:ql)?\b",)),
    "power-bi": ("Power BI", "Analytics", (r"\bpower\s*bi\b",)),
    "tableau": ("Tableau", "Analytics", (r"\btableau\b",)),
    "dbt": ("dbt", "Data Engineering", (r"\bdbt\b",)),
    "apache-spark": ("Apache Spark", "Data Engineering", (r"\b(?:apache\s+)?spark\b",)),
    "airflow": ("Airflow", "Data Engineering", (r"\bairflow\b",)),
    "docker": ("Docker", "Cloud & DevOps", (r"\bdocker\b",)),
    "kubernetes": ("Kubernetes", "Cloud & DevOps", (r"\bkubernetes\b", r"\bk8s\b")),
    "aws": ("AWS", "Cloud & DevOps", (r"\baws\b", r"amazon web services")),
    "azure": ("Azure", "Cloud & DevOps", (r"\bazure\b",)),
    "google-cloud": ("Google Cloud", "Cloud & DevOps", (r"\bgcp\b", r"google cloud")),
    "terraform": ("Terraform", "Cloud & DevOps", (r"\bterraform\b",)),
    "github-actions": ("GitHub Actions", "Delivery", (r"github actions",)),
    "ci-cd": ("CI/CD", "Delivery", (r"\bci\s*/\s*cd\b", r"continuous integration")),
    "machine-learning": ("Machine Learning", "AI & ML", (r"machine learning", r"\bml\b")),
    "llm": ("Large Language Models", "AI & ML", (r"large language model", r"\bllms?\b")),
    "rag": ("RAG", "AI & ML", (r"\brag\b", r"retrieval[- ]augmented generation")),
    "automated-testing": (
        "Automated Testing",
        "Quality",
        (r"automated testing", r"test automation", r"\bpytest\b", r"\bplaywright\b"),
    ),
    "rest-api": ("REST APIs", "Software Engineering", (r"\brest(?:ful)?\s+apis?\b",)),
    "git": ("Git", "Software Engineering", (r"\bgit\b", r"\bgithub\b", r"\bgitlab\b")),
    "agile": ("Agile", "Delivery", (r"\bagile\b", r"\bscrum\b")),
}

ROLE_REQUIREMENTS: dict[str, tuple[tuple[str, float, bool], ...]] = {
    "software": (
        ("javascript", 1.0, False), ("typescript", 1.2, False), ("react", 1.1, False),
        ("node-js", 1.0, False), ("rest-api", 1.4, True), ("sql", 1.1, True),
        ("git", 1.0, True), ("automated-testing", 1.3, True), ("docker", 0.8, False),
    ),
    "data-analyst": (
        ("sql", 1.6, True), ("power-bi", 1.4, False), ("tableau", 1.0, False),
        ("python", 1.0, False), ("postgresql", 0.8, False), ("git", 0.6, False),
    ),
    "data-engineer": (
        ("python", 1.4, True), ("sql", 1.6, True), ("postgresql", 1.0, False),
        ("dbt", 1.2, False), ("airflow", 1.2, False), ("apache-spark", 1.1, False),
        ("docker", 1.0, True), ("git", 0.7, False), ("ci-cd", 0.8, False),
    ),
    "ai": (
        ("python", 1.5, True), ("machine-learning", 1.2, False), ("llm", 1.3, True),
        ("rag", 1.3, False), ("fastapi", 1.0, False), ("rest-api", 1.0, True),
        ("automated-testing", 1.2, True), ("docker", 1.0, False), ("git", 0.7, False),
    ),
    "cloud-devops": (
        ("docker", 1.5, True), ("kubernetes", 1.3, False), ("terraform", 1.4, True),
        ("aws", 1.0, False), ("azure", 1.0, False), ("google-cloud", 1.0, False),
        ("ci-cd", 1.3, True), ("github-actions", 0.9, False), ("python", 0.7, False),
    ),
}


def slug_for_name(name: str) -> str | None:
    return next((slug for slug, (label, _, _) in SKILLS.items() if label == name), None)
