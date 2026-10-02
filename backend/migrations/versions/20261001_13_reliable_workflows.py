"""Add application links, status history, durable email and collector queues."""

from alembic import op
import sqlalchemy as sa


revision = "20261001_13"
down_revision = "20261001_12"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.add_column("saved_jobs", sa.Column("analysis_id", sa.UUID(), nullable=True))
    op.create_index("ix_saved_jobs_analysis_id", "saved_jobs", ["analysis_id"])
    op.create_foreign_key(
        "fk_saved_jobs_analysis_id", "saved_jobs", "job_analyses", ["analysis_id"], ["id"], ondelete="SET NULL"
    )

    op.create_table(
        "job_status_events",
        sa.Column("id", sa.UUID(), nullable=False),
        sa.Column("saved_job_id", sa.UUID(), nullable=False),
        sa.Column("from_status", sa.String(length=30), nullable=True),
        sa.Column("to_status", sa.String(length=30), nullable=False),
        sa.Column("changed_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
        sa.ForeignKeyConstraint(["saved_job_id"], ["saved_jobs.id"], ondelete="CASCADE"),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index("ix_job_status_events_saved_job_id", "job_status_events", ["saved_job_id"])
    op.create_index("ix_job_status_events_to_status", "job_status_events", ["to_status"])

    op.create_table(
        "email_outbox",
        sa.Column("id", sa.UUID(), nullable=False),
        sa.Column("recipient", sa.String(length=320), nullable=False),
        sa.Column("subject", sa.String(length=255), nullable=False),
        sa.Column("body", sa.Text(), nullable=False),
        sa.Column("status", sa.String(length=20), server_default="queued", nullable=False),
        sa.Column("attempts", sa.Integer(), server_default="0", nullable=False),
        sa.Column("available_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
        sa.Column("locked_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("sent_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("last_error", sa.Text(), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index("ix_email_outbox_status", "email_outbox", ["status"])
    op.create_index("ix_email_outbox_available_at", "email_outbox", ["available_at"])

    op.add_column("collector_runs", sa.Column("attempts", sa.Integer(), server_default="0", nullable=False))
    op.add_column(
        "collector_runs",
        sa.Column("available_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
    )
    op.add_column("collector_runs", sa.Column("locked_at", sa.DateTime(timezone=True), nullable=True))
    op.add_column(
        "collector_runs",
        sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
    )
    op.create_index("ix_collector_runs_available_at", "collector_runs", ["available_at"])


def downgrade() -> None:
    op.drop_index("ix_collector_runs_available_at", table_name="collector_runs")
    op.drop_column("collector_runs", "updated_at")
    op.drop_column("collector_runs", "locked_at")
    op.drop_column("collector_runs", "available_at")
    op.drop_column("collector_runs", "attempts")
    op.drop_index("ix_email_outbox_available_at", table_name="email_outbox")
    op.drop_index("ix_email_outbox_status", table_name="email_outbox")
    op.drop_table("email_outbox")
    op.drop_index("ix_job_status_events_to_status", table_name="job_status_events")
    op.drop_index("ix_job_status_events_saved_job_id", table_name="job_status_events")
    op.drop_table("job_status_events")
    op.drop_constraint("fk_saved_jobs_analysis_id", "saved_jobs", type_="foreignkey")
    op.drop_index("ix_saved_jobs_analysis_id", table_name="saved_jobs")
    op.drop_column("saved_jobs", "analysis_id")
