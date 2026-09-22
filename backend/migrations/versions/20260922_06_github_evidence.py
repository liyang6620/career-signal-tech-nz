"""Add public GitHub project evidence."""

import sqlalchemy as sa
from alembic import op

revision = "20260922_06"
down_revision = "20260922_05"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.create_table(
        "github_projects",
        sa.Column("id", sa.Uuid(), primary_key=True),
        sa.Column("user_id", sa.Uuid(), sa.ForeignKey("users.id", ondelete="CASCADE"), nullable=False),
        sa.Column("canonical_url", sa.Text(), nullable=False),
        sa.Column("owner", sa.String(100), nullable=False),
        sa.Column("repository", sa.String(100), nullable=False),
        sa.Column("description", sa.Text()),
        sa.Column("default_branch", sa.String(120)),
        sa.Column("stars", sa.Integer(), nullable=False),
        sa.Column("language", sa.String(80)),
        sa.Column("topics", sa.Text(), nullable=False),
        sa.Column("readme_excerpt", sa.Text()),
        sa.Column("status", sa.String(30), nullable=False),
        sa.Column("fetched_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
        sa.UniqueConstraint("user_id", "canonical_url"),
    )
    op.create_index("ix_github_projects_user_id", "github_projects", ["user_id"])
    op.create_index("ix_github_projects_status", "github_projects", ["status"])
    op.create_table(
        "github_suggestions",
        sa.Column("id", sa.Uuid(), primary_key=True),
        sa.Column("project_id", sa.Uuid(), sa.ForeignKey("github_projects.id", ondelete="CASCADE"), nullable=False),
        sa.Column("canonical_skill", sa.String(100), nullable=False),
        sa.Column("category", sa.String(60), nullable=False),
        sa.Column("excerpt", sa.Text(), nullable=False),
        sa.Column("confidence", sa.Float(), nullable=False),
        sa.Column("proposed_level", sa.Integer(), nullable=False),
        sa.Column("review_status", sa.String(20), nullable=False),
        sa.Column("reviewed_at", sa.DateTime(timezone=True)),
        sa.UniqueConstraint("project_id", "canonical_skill"),
    )
    op.create_index("ix_github_suggestions_project_id", "github_suggestions", ["project_id"])
    op.create_index("ix_github_suggestions_canonical_skill", "github_suggestions", ["canonical_skill"])
    op.create_index("ix_github_suggestions_review_status", "github_suggestions", ["review_status"])
    op.alter_column("candidate_skill_evidence", "upload_id", nullable=True)
    op.alter_column("candidate_skill_evidence", "suggestion_id", nullable=True)
    op.add_column("candidate_skill_evidence", sa.Column("github_project_id", sa.Uuid(), nullable=True))
    op.add_column("candidate_skill_evidence", sa.Column("github_suggestion_id", sa.Uuid(), nullable=True))
    op.create_foreign_key(
        "fk_candidate_skill_evidence_github_project", "candidate_skill_evidence", "github_projects",
        ["github_project_id"], ["id"], ondelete="CASCADE",
    )
    op.create_foreign_key(
        "fk_candidate_skill_evidence_github_suggestion", "candidate_skill_evidence", "github_suggestions",
        ["github_suggestion_id"], ["id"], ondelete="CASCADE",
    )
    op.create_index("ix_candidate_skill_evidence_github_project_id", "candidate_skill_evidence", ["github_project_id"])
    op.create_index(
        "ix_candidate_skill_evidence_github_suggestion_id", "candidate_skill_evidence", ["github_suggestion_id"],
        unique=True,
    )


def downgrade() -> None:
    op.drop_constraint("fk_candidate_skill_evidence_github_suggestion", "candidate_skill_evidence", type_="foreignkey")
    op.drop_constraint("fk_candidate_skill_evidence_github_project", "candidate_skill_evidence", type_="foreignkey")
    op.drop_column("candidate_skill_evidence", "github_suggestion_id")
    op.drop_column("candidate_skill_evidence", "github_project_id")
    op.alter_column("candidate_skill_evidence", "suggestion_id", nullable=False)
    op.alter_column("candidate_skill_evidence", "upload_id", nullable=False)
    op.drop_table("github_suggestions")
    op.drop_table("github_projects")
