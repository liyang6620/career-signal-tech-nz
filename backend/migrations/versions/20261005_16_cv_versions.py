"""Store a label and target role for each uploaded CV version."""

from alembic import op
import sqlalchemy as sa


revision = "20261005_16"
down_revision = "20261002_15"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.add_column("evidence_uploads", sa.Column("cv_label", sa.String(length=160), nullable=True))
    op.add_column("evidence_uploads", sa.Column("target_role", sa.String(length=80), nullable=True))
    op.create_index("ix_evidence_uploads_target_role", "evidence_uploads", ["target_role"])


def downgrade() -> None:
    op.drop_index("ix_evidence_uploads_target_role", table_name="evidence_uploads")
    op.drop_column("evidence_uploads", "target_role")
    op.drop_column("evidence_uploads", "cv_label")
