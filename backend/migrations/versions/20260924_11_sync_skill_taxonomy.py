"""Synchronise the canonical skill catalogue with the application taxonomy."""

import uuid

import sqlalchemy as sa
from alembic import op
from sqlalchemy.dialects.postgresql import insert

revision = "20260924_11"
down_revision = "20260922_10"
branch_labels = None
depends_on = None

SKILLS = (
    ("python", "Python", "Programming"),
    ("javascript", "JavaScript", "Programming"),
    ("typescript", "TypeScript", "Programming"),
    ("html", "HTML", "Frontend"),
    ("css", "CSS", "Frontend"),
    ("tailwind", "Tailwind CSS", "Frontend"),
    ("next-js", "Next.js", "Frontend"),
    ("java", "Java", "Programming"),
    ("c-sharp", "C#", "Programming"),
    ("c", "C", "Programming"),
    ("cpp", "C++", "Programming"),
    ("react", "React", "Frontend"),
    ("node-js", "Node.js", "Backend"),
    ("fastapi", "FastAPI", "Backend"),
    ("flask", "Flask", "Backend"),
    ("django", "Django", "Backend"),
    ("ruby-on-rails", "Ruby on Rails", "Backend"),
    ("sql", "SQL", "Data"),
    ("pandas", "Pandas", "Data"),
    ("numpy", "NumPy", "Data"),
    ("scikit-learn", "scikit-learn", "AI & ML"),
    ("matplotlib", "Matplotlib", "Analytics"),
    ("postgresql", "PostgreSQL", "Data"),
    ("excel", "Microsoft Excel", "Analytics"),
    ("ms-access", "Microsoft Access", "Data"),
    ("power-bi", "Power BI", "Analytics"),
    ("tableau", "Tableau", "Analytics"),
    ("dbt", "dbt", "Data Engineering"),
    ("apache-spark", "Apache Spark", "Data Engineering"),
    ("airflow", "Airflow", "Data Engineering"),
    ("etl", "ETL", "Data Engineering"),
    ("big-data", "Big Data", "Data Engineering"),
    ("geospatial-data", "Geospatial Data", "Data"),
    ("data-quality", "Data Quality", "Data"),
    ("systems-analysis", "Systems Analysis", "Business Technology"),
    ("analytical-reasoning", "Analytical Reasoning", "Professional Capability"),
    ("root-cause-analysis", "Root Cause Analysis", "Professional Capability"),
    ("problem-solving", "Problem Solving", "Professional Capability"),
    ("attention-to-detail", "Attention to Detail", "Professional Capability"),
    ("docker", "Docker", "Cloud & DevOps"),
    ("linux", "Linux", "Cloud & DevOps"),
    ("bash", "Bash", "Cloud & DevOps"),
    ("kubernetes", "Kubernetes", "Cloud & DevOps"),
    ("aws", "AWS", "Cloud & DevOps"),
    ("azure", "Azure", "Cloud & DevOps"),
    ("google-cloud", "Google Cloud", "Cloud & DevOps"),
    ("terraform", "Terraform", "Cloud & DevOps"),
    ("github-actions", "GitHub Actions", "Delivery"),
    ("ci-cd", "CI/CD", "Delivery"),
    ("machine-learning", "Machine Learning", "AI & ML"),
    ("llm", "Large Language Models", "AI & ML"),
    ("rag", "RAG", "AI & ML"),
    ("embeddings", "Embeddings", "AI & ML"),
    ("vector-databases", "Vector Databases", "AI & ML"),
    ("computer-vision", "Computer Vision", "AI & ML"),
    ("embedded-systems", "Embedded Systems", "Hardware"),
    ("iot", "IoT", "Hardware"),
    ("cad", "CAD", "Engineering"),
    ("prototyping", "Prototyping", "Engineering"),
    ("web-applications", "Web Applications", "Software Engineering"),
    ("data-visualisation", "Data Visualisation", "Analytics"),
    ("automated-testing", "Automated Testing", "Quality"),
    ("rest-api", "REST APIs", "Software Engineering"),
    ("git", "Git", "Software Engineering"),
    ("agile", "Agile", "Delivery"),
)

NEW_REQUIREMENTS = (
    ("software", "web-applications", 0.8, False),
    ("ai", "embeddings", 0.9, False),
    ("ai", "vector-databases", 0.9, False),
    ("ai", "computer-vision", 0.8, False),
)


def upgrade() -> None:
    skills = sa.table(
        "canonical_skills",
        sa.column("slug", sa.String),
        sa.column("name", sa.String),
        sa.column("category", sa.String),
        sa.column("taxonomy_version", sa.String),
    )
    skill_values = [
        {"slug": slug, "name": name, "category": category, "taxonomy_version": "2026.2"}
        for slug, name, category in SKILLS
    ]
    op.get_bind().execute(
        insert(skills).values(skill_values).on_conflict_do_update(
            index_elements=[skills.c.slug],
            set_={
                "name": sa.literal_column("excluded.name"),
                "category": sa.literal_column("excluded.category"),
                "taxonomy_version": sa.literal_column("excluded.taxonomy_version"),
            },
        )
    )

    requirements = sa.table(
        "role_skill_requirements",
        sa.column("id", sa.Uuid),
        sa.column("role_family", sa.String),
        sa.column("skill_slug", sa.String),
        sa.column("weight", sa.Float),
        sa.column("required", sa.Boolean),
    )
    requirement_values = [
        {
            "id": uuid.uuid4(),
            "role_family": role,
            "skill_slug": slug,
            "weight": weight,
            "required": required,
        }
        for role, slug, weight, required in NEW_REQUIREMENTS
    ]
    op.get_bind().execute(
        insert(requirements).values(requirement_values).on_conflict_do_update(
            index_elements=[requirements.c.role_family, requirements.c.skill_slug],
            set_={"weight": sa.literal_column("excluded.weight"), "required": sa.literal_column("excluded.required")},
        )
    )


def downgrade() -> None:
    # Canonical taxonomy rows are retained because candidate evidence may reference them.
    pass
