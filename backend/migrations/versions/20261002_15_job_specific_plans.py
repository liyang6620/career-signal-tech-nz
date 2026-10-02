"""Link development plans to a specific saved opportunity."""

from alembic import op
import sqlalchemy as sa


revision = "20261002_15"
down_revision = "20261002_14"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.add_column("development_plan_tasks", sa.Column("saved_job_id", sa.UUID(), nullable=True))
    op.create_foreign_key(
        "fk_development_plan_tasks_saved_job_id",
        "development_plan_tasks",
        "saved_jobs",
        ["saved_job_id"],
        ["id"],
        ondelete="SET NULL",
    )
    op.create_index(
        "ix_development_plan_tasks_saved_job_id",
        "development_plan_tasks",
        ["saved_job_id"],
    )


def downgrade() -> None:
    op.drop_index("ix_development_plan_tasks_saved_job_id", table_name="development_plan_tasks")
    op.drop_constraint(
        "fk_development_plan_tasks_saved_job_id",
        "development_plan_tasks",
        type_="foreignkey",
    )
    op.drop_column("development_plan_tasks", "saved_job_id")
