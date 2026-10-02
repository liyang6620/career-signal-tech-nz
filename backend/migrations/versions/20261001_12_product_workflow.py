"""Add persisted job decisions and role decoder history.

Revision ID: 20261001_12
Revises: 20260924_11
"""

from alembic import op
import sqlalchemy as sa


revision = "20261001_12"
down_revision = "20260924_11"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.create_table(
        "saved_jobs",
        sa.Column("id", sa.UUID(), nullable=False),
        sa.Column("user_id", sa.UUID(), nullable=False),
        sa.Column("source_url", sa.Text(), nullable=False),
        sa.Column("title", sa.String(length=240), nullable=False),
        sa.Column("company", sa.String(length=180), nullable=False),
        sa.Column("location", sa.String(length=120), nullable=False),
        sa.Column("role_family", sa.String(length=80), nullable=True),
        sa.Column("description", sa.Text(), nullable=True),
        sa.Column("status", sa.String(length=30), nullable=False, server_default="saved"),
        sa.Column("notes", sa.Text(), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
        sa.ForeignKeyConstraint(["user_id"], ["users.id"], ondelete="CASCADE"),
        sa.PrimaryKeyConstraint("id"),
        sa.UniqueConstraint("user_id", "source_url"),
    )
    op.create_index("ix_saved_jobs_user_id", "saved_jobs", ["user_id"])
    op.create_index("ix_saved_jobs_role_family", "saved_jobs", ["role_family"])
    op.create_index("ix_saved_jobs_status", "saved_jobs", ["status"])

    op.create_table(
        "job_analyses",
        sa.Column("id", sa.UUID(), nullable=False),
        sa.Column("user_id", sa.UUID(), nullable=False),
        sa.Column("title", sa.String(length=240), nullable=False, server_default=""),
        sa.Column("description", sa.Text(), nullable=False),
        sa.Column("role_family", sa.String(length=80), nullable=False),
        sa.Column("scope_status", sa.String(length=30), nullable=False),
        sa.Column("confidence", sa.Float(), nullable=False),
        sa.Column("result_json", sa.Text(), nullable=False),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
        sa.ForeignKeyConstraint(["user_id"], ["users.id"], ondelete="CASCADE"),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index("ix_job_analyses_user_id", "job_analyses", ["user_id"])
    op.create_index("ix_job_analyses_role_family", "job_analyses", ["role_family"])
    op.create_index("ix_job_analyses_created_at", "job_analyses", ["created_at"])


def downgrade() -> None:
    op.drop_index("ix_job_analyses_created_at", table_name="job_analyses")
    op.drop_index("ix_job_analyses_role_family", table_name="job_analyses")
    op.drop_index("ix_job_analyses_user_id", table_name="job_analyses")
    op.drop_table("job_analyses")
    op.drop_index("ix_saved_jobs_status", table_name="saved_jobs")
    op.drop_index("ix_saved_jobs_role_family", table_name="saved_jobs")
    op.drop_index("ix_saved_jobs_user_id", table_name="saved_jobs")
    op.drop_table("saved_jobs")
