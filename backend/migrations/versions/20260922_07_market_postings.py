"""Add governed market sources and classified job postings."""

import sqlalchemy as sa
from alembic import op

revision = "20260922_07"
down_revision = "20260922_06"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.create_table(
        "market_sources",
        sa.Column("id", sa.Uuid(), primary_key=True),
        sa.Column("name", sa.String(160), nullable=False),
        sa.Column("source_type", sa.String(50), nullable=False),
        sa.Column("permission_basis", sa.Text(), nullable=False),
        sa.Column("base_url", sa.Text(), nullable=False),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
    )
    op.create_table(
        "job_postings",
        sa.Column("id", sa.Uuid(), primary_key=True),
        sa.Column("source_id", sa.Uuid(), sa.ForeignKey("market_sources.id", ondelete="RESTRICT"), nullable=False),
        sa.Column("source_url", sa.Text(), nullable=False, unique=True),
        sa.Column("content_hash", sa.String(64), nullable=False),
        sa.Column("title", sa.String(240), nullable=False),
        sa.Column("company", sa.String(180), nullable=False),
        sa.Column("location", sa.String(120), nullable=False),
        sa.Column("description", sa.Text(), nullable=False),
        sa.Column("role_family", sa.String(80), nullable=False),
        sa.Column("seniority", sa.String(50), nullable=False),
        sa.Column("classification_confidence", sa.Float(), nullable=False),
        sa.Column("published_at", sa.DateTime(timezone=True)),
        sa.Column("retrieved_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
    )
    for column in ("source_id", "content_hash", "location", "role_family", "seniority", "published_at"):
        op.create_index(f"ix_job_postings_{column}", "job_postings", [column])
    op.create_table(
        "job_posting_skills",
        sa.Column("id", sa.Uuid(), primary_key=True),
        sa.Column("posting_id", sa.Uuid(), sa.ForeignKey("job_postings.id", ondelete="CASCADE"), nullable=False),
        sa.Column("skill_slug", sa.String(100), sa.ForeignKey("canonical_skills.slug"), nullable=False),
        sa.Column("mention_count", sa.Integer(), nullable=False),
        sa.UniqueConstraint("posting_id", "skill_slug"),
    )
    op.create_index("ix_job_posting_skills_posting_id", "job_posting_skills", ["posting_id"])
    op.create_index("ix_job_posting_skills_skill_slug", "job_posting_skills", ["skill_slug"])


def downgrade() -> None:
    op.drop_table("job_posting_skills")
    op.drop_table("job_postings")
    op.drop_table("market_sources")
