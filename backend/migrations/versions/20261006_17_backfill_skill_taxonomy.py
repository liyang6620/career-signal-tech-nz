"""Backfill skills added after the original taxonomy migration was deployed."""

import sqlalchemy as sa
from alembic import op
from sqlalchemy.dialects.postgresql import insert


revision = "20261006_17"
down_revision = "20261005_16"
branch_labels = None
depends_on = None

SKILLS = (
    ("html", "HTML", "Frontend"),
    ("css", "CSS", "Frontend"),
    ("tailwind", "Tailwind CSS", "Frontend"),
    ("next-js", "Next.js", "Frontend"),
    ("flask", "Flask", "Backend"),
    ("django", "Django", "Backend"),
    ("pandas", "Pandas", "Data"),
    ("numpy", "NumPy", "Data"),
    ("scikit-learn", "scikit-learn", "AI & ML"),
    ("matplotlib", "Matplotlib", "Analytics"),
    ("linux", "Linux", "Cloud & DevOps"),
    ("bash", "Bash", "Cloud & DevOps"),
)


def upgrade() -> None:
    skills = sa.table(
        "canonical_skills",
        sa.column("slug", sa.String),
        sa.column("name", sa.String),
        sa.column("category", sa.String),
        sa.column("taxonomy_version", sa.String),
    )
    values = [
        {"slug": slug, "name": name, "category": category, "taxonomy_version": "2026.2"}
        for slug, name, category in SKILLS
    ]
    op.get_bind().execute(
        insert(skills).values(values).on_conflict_do_update(
            index_elements=[skills.c.slug],
            set_={
                "name": sa.literal_column("excluded.name"),
                "category": sa.literal_column("excluded.category"),
                "taxonomy_version": sa.literal_column("excluded.taxonomy_version"),
            },
        )
    )


def downgrade() -> None:
    # Keep canonical rows because existing evidence may reference them.
    pass
