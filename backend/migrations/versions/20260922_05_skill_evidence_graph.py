"""Add canonical skills, role requirements and confirmed evidence."""

import sqlalchemy as sa
from alembic import op

revision = "20260922_05"
down_revision = "20260922_04"
branch_labels = None
depends_on = None

SKILLS = (
    ("python", "Python", "Programming"), ("javascript", "JavaScript", "Programming"),
    ("typescript", "TypeScript", "Programming"), ("java", "Java", "Programming"),
    ("c-sharp", "C#", "Programming"), ("react", "React", "Frontend"),
    ("node-js", "Node.js", "Backend"), ("fastapi", "FastAPI", "Backend"),
    ("sql", "SQL", "Data"), ("postgresql", "PostgreSQL", "Data"),
    ("power-bi", "Power BI", "Analytics"), ("tableau", "Tableau", "Analytics"),
    ("dbt", "dbt", "Data Engineering"), ("apache-spark", "Apache Spark", "Data Engineering"),
    ("airflow", "Airflow", "Data Engineering"), ("docker", "Docker", "Cloud & DevOps"),
    ("kubernetes", "Kubernetes", "Cloud & DevOps"), ("aws", "AWS", "Cloud & DevOps"),
    ("azure", "Azure", "Cloud & DevOps"), ("google-cloud", "Google Cloud", "Cloud & DevOps"),
    ("terraform", "Terraform", "Cloud & DevOps"), ("github-actions", "GitHub Actions", "Delivery"),
    ("ci-cd", "CI/CD", "Delivery"), ("machine-learning", "Machine Learning", "AI & ML"),
    ("llm", "Large Language Models", "AI & ML"), ("rag", "RAG", "AI & ML"),
    ("automated-testing", "Automated Testing", "Quality"),
    ("rest-api", "REST APIs", "Software Engineering"),
    ("git", "Git", "Software Engineering"), ("agile", "Agile", "Delivery"),
)

REQUIREMENTS = {
    "software": (("javascript", 1.0, False), ("typescript", 1.2, False), ("react", 1.1, False),
                 ("node-js", 1.0, False), ("rest-api", 1.4, True), ("sql", 1.1, True),
                 ("git", 1.0, True), ("automated-testing", 1.3, True), ("docker", 0.8, False)),
    "data-analyst": (("sql", 1.6, True), ("power-bi", 1.4, False), ("tableau", 1.0, False),
                     ("python", 1.0, False), ("postgresql", 0.8, False), ("git", 0.6, False)),
    "data-engineer": (("python", 1.4, True), ("sql", 1.6, True), ("postgresql", 1.0, False),
                      ("dbt", 1.2, False), ("airflow", 1.2, False), ("apache-spark", 1.1, False),
                      ("docker", 1.0, True), ("git", 0.7, False), ("ci-cd", 0.8, False)),
    "ai": (("python", 1.5, True), ("machine-learning", 1.2, False), ("llm", 1.3, True),
           ("rag", 1.3, False), ("fastapi", 1.0, False), ("rest-api", 1.0, True),
           ("automated-testing", 1.2, True), ("docker", 1.0, False), ("git", 0.7, False)),
    "cloud-devops": (("docker", 1.5, True), ("kubernetes", 1.3, False), ("terraform", 1.4, True),
                     ("aws", 1.0, False), ("azure", 1.0, False), ("google-cloud", 1.0, False),
                     ("ci-cd", 1.3, True), ("github-actions", 0.9, False), ("python", 0.7, False)),
}


def upgrade() -> None:
    op.create_table(
        "canonical_skills",
        sa.Column("slug", sa.String(100), primary_key=True),
        sa.Column("name", sa.String(100), nullable=False, unique=True),
        sa.Column("category", sa.String(60), nullable=False),
        sa.Column("taxonomy_version", sa.String(20), nullable=False),
    )
    op.create_index("ix_canonical_skills_category", "canonical_skills", ["category"])
    op.create_table(
        "role_skill_requirements",
        sa.Column("id", sa.Uuid(), primary_key=True),
        sa.Column("role_family", sa.String(80), nullable=False),
        sa.Column("skill_slug", sa.String(100), sa.ForeignKey("canonical_skills.slug"), nullable=False),
        sa.Column("weight", sa.Float(), nullable=False),
        sa.Column("required", sa.Boolean(), nullable=False),
        sa.UniqueConstraint("role_family", "skill_slug"),
    )
    op.create_index("ix_role_skill_requirements_role_family", "role_skill_requirements", ["role_family"])
    op.create_index("ix_role_skill_requirements_skill_slug", "role_skill_requirements", ["skill_slug"])
    op.create_table(
        "candidate_skill_evidence",
        sa.Column("id", sa.Uuid(), primary_key=True),
        sa.Column("user_id", sa.Uuid(), sa.ForeignKey("users.id", ondelete="CASCADE"), nullable=False),
        sa.Column("upload_id", sa.Uuid(), sa.ForeignKey("evidence_uploads.id", ondelete="CASCADE"), nullable=False),
        sa.Column(
            "suggestion_id", sa.Uuid(), sa.ForeignKey("evidence_suggestions.id", ondelete="CASCADE"),
            nullable=False, unique=True,
        ),
        sa.Column("skill_slug", sa.String(100), sa.ForeignKey("canonical_skills.slug"), nullable=False),
        sa.Column("evidence_level", sa.Integer(), nullable=False),
        sa.Column("confidence", sa.Float(), nullable=False),
        sa.Column("excerpt", sa.Text(), nullable=False),
        sa.Column("locator", sa.String(80), nullable=False),
        sa.Column("source_type", sa.String(30), nullable=False),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
    )
    op.create_index("ix_candidate_skill_evidence_user_id", "candidate_skill_evidence", ["user_id"])
    op.create_index("ix_candidate_skill_evidence_upload_id", "candidate_skill_evidence", ["upload_id"])
    op.create_index("ix_candidate_skill_evidence_suggestion_id", "candidate_skill_evidence", ["suggestion_id"])
    op.create_index("ix_candidate_skill_evidence_skill_slug", "candidate_skill_evidence", ["skill_slug"])

    skill_table = sa.table(
        "canonical_skills", sa.column("slug"), sa.column("name"), sa.column("category"), sa.column("taxonomy_version")
    )
    op.bulk_insert(
        skill_table,
        [{"slug": slug, "name": name, "category": category, "taxonomy_version": "2026.1"}
         for slug, name, category in SKILLS],
    )
    requirement_table = sa.table(
        "role_skill_requirements", sa.column("id"), sa.column("role_family"), sa.column("skill_slug"),
        sa.column("weight"), sa.column("required"),
    )
    import uuid

    op.bulk_insert(
        requirement_table,
        [{"id": uuid.uuid4(), "role_family": role, "skill_slug": slug, "weight": weight, "required": required}
         for role, requirements in REQUIREMENTS.items() for slug, weight, required in requirements],
    )


def downgrade() -> None:
    op.drop_table("candidate_skill_evidence")
    op.drop_table("role_skill_requirements")
    op.drop_table("canonical_skills")
