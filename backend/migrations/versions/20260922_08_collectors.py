"""Add governed collector sources and auditable runs."""

import sqlalchemy as sa
from alembic import op

revision = "20260922_08"
down_revision = "20260922_07"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.create_table(
        "collector_sources",
        sa.Column("id", sa.Uuid(), primary_key=True),
        sa.Column("name", sa.String(160), nullable=False),
        sa.Column("adapter", sa.String(30), nullable=False),
        sa.Column("identifier", sa.Text(), nullable=False),
        sa.Column("company", sa.String(180), nullable=False),
        sa.Column("permission_basis", sa.Text(), nullable=False),
        sa.Column("enabled", sa.Boolean(), server_default=sa.true(), nullable=False),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
        sa.UniqueConstraint("adapter", "identifier", name="uq_collector_source_adapter_identifier"),
    )
    op.create_index("ix_collector_sources_adapter", "collector_sources", ["adapter"])
    op.create_table(
        "collector_runs",
        sa.Column("id", sa.Uuid(), primary_key=True),
        sa.Column(
            "collector_source_id",
            sa.Uuid(),
            sa.ForeignKey("collector_sources.id", ondelete="CASCADE"),
            nullable=False,
        ),
        sa.Column("status", sa.String(20), nullable=False),
        sa.Column("fetched_count", sa.Integer(), server_default="0", nullable=False),
        sa.Column("accepted_count", sa.Integer(), server_default="0", nullable=False),
        sa.Column("rejected_count", sa.Integer(), server_default="0", nullable=False),
        sa.Column("error_message", sa.Text()),
        sa.Column("started_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
        sa.Column("completed_at", sa.DateTime(timezone=True)),
    )
    op.create_index("ix_collector_runs_collector_source_id", "collector_runs", ["collector_source_id"])
    op.create_index("ix_collector_runs_status", "collector_runs", ["status"])


def downgrade() -> None:
    op.drop_table("collector_runs")
    op.drop_table("collector_sources")
