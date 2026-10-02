SKILLS: dict[str, tuple[str, str, tuple[str, ...]]] = {
    "python": ("Python", "Programming", (r"\bpython\b",)),
    "javascript": ("JavaScript", "Programming", (r"\bjavascript\b", r"\bjs\b")),
    "typescript": ("TypeScript", "Programming", (r"\btypescript\b",)),
    "java": ("Java", "Programming", (r"\bjava\b",)),
    "c-sharp": ("C#", "Programming", (r"(?<!\w)c#(?!\w)", r"\b\.net\b")),
    "c": ("C", "Programming", (r"\bc(?=\s*[,/]\s*c\+\+)", r"\bc programming\b")),
    "cpp": ("C++", "Programming", (r"(?<!\w)c\+\+(?!\w)", r"\bcpp\b")),
    "react": ("React", "Frontend", (r"\breact(?:\.js)?\b",)),
    "node-js": ("Node.js", "Backend", (r"\bnode(?:\.js)?\b",)),
    "fastapi": ("FastAPI", "Backend", (r"\bfastapi\b",)),
    "ruby-on-rails": ("Ruby on Rails", "Backend", (r"\bruby on rails\b", r"\bruby\b")),
    "sql": ("SQL", "Data", (r"\bsql\b",)),
    "postgresql": ("PostgreSQL", "Data", (r"\bpostgres(?:s?ql)?\b",)),
    "excel": ("Microsoft Excel", "Analytics", (r"\b(?:microsoft |ms )?excel\b",)),
    "ms-access": ("Microsoft Access", "Data", (r"\b(?:microsoft|ms) access\b",)),
    "power-bi": ("Power BI", "Analytics", (r"\bpower\s*bi\b",)),
    "tableau": ("Tableau", "Analytics", (r"\btableau\b",)),
    "dbt": ("dbt", "Data Engineering", (r"\bdbt\b",)),
    "apache-spark": ("Apache Spark", "Data Engineering", (r"\b(?:apache\s+)?spark\b",)),
    "airflow": ("Airflow", "Data Engineering", (r"\bairflow\b",)),
    "etl": ("ETL", "Data Engineering", (r"\betl\b", r"extract\s*,?\s*transform\s*,?\s*(?:and\s*)?load")),
    "big-data": ("Big Data", "Data Engineering", (r"\bbig data\b",)),
    "geospatial-data": ("Geospatial Data", "Data", (r"\bgeospatial data\b", r"\bgeospatial\b", r"\bgis data\b")),
    "data-quality": (
        "Data Quality",
        "Data",
        (r"\bdata quality\b", r"\bdata inconsistenc(?:y|ies)\b", r"\bdata could go wrong\b", r"\bdata issues?\b"),
    ),
    "systems-analysis": (
        "Systems Analysis",
        "Business Technology",
        (r"\bsystems? analys(?:is|t)\b", r"\bcomplex systems?\b", r"\bunderstand and navigate complex systems?\b"),
    ),
    "analytical-reasoning": (
        "Analytical Reasoning",
        "Professional Capability",
        (r"\banalytical mindset\b", r"\bidentify patterns\b", r"\banalytical thinking\b"),
    ),
    "root-cause-analysis": (
        "Root Cause Analysis",
        "Professional Capability",
        (r"\broot cause\b", r"\binvestigat(?:e|ing) (?:a |the )?problem\b"),
    ),
    "problem-solving": (
        "Problem Solving",
        "Professional Capability",
        (r"\bproblem[- ]solving\b", r"\bsolutions?[- ]focused\b", r"\bwork out how to resolve\b"),
    ),
    "attention-to-detail": (
        "Attention to Detail",
        "Professional Capability",
        (r"\battention to detail\b",),
    ),
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
    "embeddings": ("Embeddings", "AI & ML", (r"\bembeddings?\b",)),
    "vector-databases": ("Vector Databases", "AI & ML", (r"\bvector databases?\b", r"\bvector stores?\b")),
    "computer-vision": ("Computer Vision", "AI & ML", (r"\bcomputer vision\b",)),
    "embedded-systems": ("Embedded Systems", "Hardware", (r"\bembedded systems?\b", r"\bmicrocontrollers?\b")),
    "iot": ("IoT", "Hardware", (r"\biot\b", r"internet of things")),
    "cad": ("CAD", "Engineering", (r"\bcad\b", r"\bsolidworks\b", r"\bfusion 360\b")),
    "prototyping": ("Prototyping", "Engineering", (r"\bprototyping\b", r"\bprototype\b")),
    "web-applications": ("Web Applications", "Software Engineering", (r"\bweb applications?\b",)),
    "data-visualisation": (
        "Data Visualisation",
        "Analytics",
        (r"\bdata visuali[sz]ation\b", r"\bvisuali[sz]ation libraries\b"),
    ),
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
        ("web-applications", 0.8, False),
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
        ("embeddings", 0.9, False), ("vector-databases", 0.9, False), ("computer-vision", 0.8, False),
    ),
    "cloud-devops": (
        ("docker", 1.5, True), ("kubernetes", 1.3, False), ("terraform", 1.4, True),
        ("aws", 1.0, False), ("azure", 1.0, False), ("google-cloud", 1.0, False),
        ("ci-cd", 1.3, True), ("github-actions", 0.9, False), ("python", 0.7, False),
    ),
}

# The requirement list is a transparent prior, not a claim that every job in a
# family has the same stack. These references identify the occupational and
# skills frameworks used to choose the prior; live NZ posting frequencies are
# applied by the evidence-fit endpoint when enough indexed postings exist.
ROLE_BENCHMARK_SOURCES: dict[str, dict[str, object]] = {
    "software": {
        "occupations": (
            "O*NET 15-1252 Software Developers",
            "O*NET 15-1253 Software Quality Assurance Analysts and Testers",
        ),
        "sources": (
            {"name": "O*NET Software Developers", "url": "https://www.onetonline.org/link/summary/15-1252.00"},
            {"name": "O*NET QA Analysts and Testers", "url": "https://www.onetonline.org/link/summary/15-1253.00"},
            {"name": "ESCO skills classification", "url": "https://esco.ec.europa.eu/en/classification/skill"},
        ),
    },
    "data-analyst": {
        "occupations": ("O*NET 15-2051 Data Scientists", "O*NET 13-1111 Management Analysts"),
        "sources": (
            {"name": "O*NET Data Scientists", "url": "https://www.onetonline.org/link/summary/15-2051.00"},
            {"name": "O*NET Management Analysts", "url": "https://www.onetonline.org/link/summary/13-1111.00"},
            {"name": "Tāhatu Career Navigator", "url": "https://tahatu.govt.nz/"},
        ),
    },
    "data-engineer": {
        "occupations": ("O*NET 15-1243 Database Architects", "O*NET 15-1242 Database Administrators"),
        "sources": (
            {"name": "O*NET Database Architects", "url": "https://www.onetonline.org/link/summary/15-1243.00"},
            {"name": "O*NET Database Administrators", "url": "https://www.onetonline.org/link/summary/15-1242.00"},
            {"name": "ESCO skills classification", "url": "https://esco.ec.europa.eu/en/classification/skill"},
        ),
    },
    "ai": {
        "occupations": ("O*NET 15-2051 Data Scientists", "O*NET 15-1252 Software Developers"),
        "sources": (
            {"name": "O*NET Data Scientists", "url": "https://www.onetonline.org/link/summary/15-2051.00"},
            {"name": "O*NET Software Developers", "url": "https://www.onetonline.org/link/summary/15-1252.00"},
            {"name": "NIST AI Risk Management Framework", "url": "https://www.nist.gov/itl/ai-risk-management-framework"},
        ),
    },
    "cloud-devops": {
        "occupations": (
            "O*NET 15-1244 Network and Computer Systems Administrators",
            "O*NET 15-1248 Computer Network Support Specialists",
        ),
        "sources": (
            {"name": "O*NET Network and Computer Systems Administrators", "url": "https://www.onetonline.org/link/summary/15-1244.00"},
            {"name": "O*NET Network Support Specialists", "url": "https://www.onetonline.org/link/summary/15-1248.00"},
            {"name": "CNCF Cloud Native Landscape", "url": "https://landscape.cncf.io/"},
            {"name": "SFIA 9 infrastructure and operations skills", "url": "https://sfia-online.org/en/sfia-9"},
        ),
    },
}

SKILL_FRAMEWORK_SOURCES = (
    {"name": "O*NET Content Model", "url": "https://www.onetcenter.org/content.html"},
    {"name": "ESCO skills classification", "url": "https://esco.ec.europa.eu/en/classification/skill"},
    {"name": "Tāhatu Career Navigator", "url": "https://tahatu.govt.nz/"},
)


def slug_for_name(name: str) -> str | None:
    return next((slug for slug, (label, _, _) in SKILLS.items() if label == name), None)
