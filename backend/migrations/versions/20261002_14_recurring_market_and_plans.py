"""Add recurring market schedules and persistent development plans."""

from alembic import op
import sqlalchemy as sa


revision = "20261002_14"
down_revision = "20261001_13"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.add_column(
        "collector_sources",
        sa.Column("refresh_interval_minutes", sa.Integer(), server_default="1440", nullable=False),
    )
    op.add_column(
        "collector_sources",
        sa.Column("minimum_interval_seconds", sa.Integer(), server_default="60", nullable=False),
    )
    op.add_column(
        "collector_sources",
        sa.Column("next_run_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
    )
    op.add_column("collector_sources", sa.Column("last_enqueued_at", sa.DateTime(timezone=True), nullable=True))
    op.create_index("ix_collector_sources_next_run_at", "collector_sources", ["next_run_at"])

    op.create_table(
        "development_plan_tasks",
        sa.Column("id", sa.UUID(), nullable=False),
        sa.Column("user_id", sa.UUID(), nullable=False),
        sa.Column("role_family", sa.String(length=80), nullable=False),
        sa.Column("skill_slug", sa.String(length=100), nullable=True),
        sa.Column("stage", sa.String(length=30), nullable=False),
        sa.Column("position", sa.Integer(), nullable=False),
        sa.Column("due_week", sa.Integer(), nullable=False),
        sa.Column("title", sa.String(length=240), nullable=False),
        sa.Column("description", sa.Text(), nullable=False),
        sa.Column("deliverable", sa.String(length=500), nullable=False),
        sa.Column("status", sa.String(length=30), server_default="pending", nullable=False),
        sa.Column("completed_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
        sa.ForeignKeyConstraint(["skill_slug"], ["canonical_skills.slug"], ondelete="SET NULL"),
        sa.ForeignKeyConstraint(["user_id"], ["users.id"], ondelete="CASCADE"),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index("ix_development_plan_tasks_user_id", "development_plan_tasks", ["user_id"])
    op.create_index("ix_development_plan_tasks_role_family", "development_plan_tasks", ["role_family"])
    op.create_index("ix_development_plan_tasks_skill_slug", "development_plan_tasks", ["skill_slug"])
    op.create_index("ix_development_plan_tasks_status", "development_plan_tasks", ["status"])


def downgrade() -> None:
    op.drop_index("ix_development_plan_tasks_status", table_name="development_plan_tasks")
    op.drop_index("ix_development_plan_tasks_skill_slug", table_name="development_plan_tasks")
    op.drop_index("ix_development_plan_tasks_role_family", table_name="development_plan_tasks")
    op.drop_index("ix_development_plan_tasks_user_id", table_name="development_plan_tasks")
    op.drop_table("development_plan_tasks")
    op.drop_index("ix_collector_sources_next_run_at", table_name="collector_sources")
    op.drop_column("collector_sources", "last_enqueued_at")
    op.drop_column("collector_sources", "next_run_at")
    op.drop_column("collector_sources", "minimum_interval_seconds")
    op.drop_column("collector_sources", "refresh_interval_minutes")
