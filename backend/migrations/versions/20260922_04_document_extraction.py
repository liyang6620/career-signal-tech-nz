"""Add document extraction and reviewable evidence suggestions."""

import sqlalchemy as sa
from alembic import op

revision = "20260922_04"
down_revision = "20260922_03"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.create_table(
        "document_extractions",
        sa.Column("id", sa.Uuid(), primary_key=True),
        sa.Column("upload_id", sa.Uuid(), sa.ForeignKey("evidence_uploads.id", ondelete="CASCADE"), nullable=False),
        sa.Column("parser_version", sa.String(40), nullable=False),
        sa.Column("text_sha256", sa.String(64), nullable=False),
        sa.Column("character_count", sa.Integer(), nullable=False),
        sa.Column("page_count", sa.Integer()),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
        sa.UniqueConstraint("upload_id"),
    )
    op.create_index("ix_document_extractions_upload_id", "document_extractions", ["upload_id"])
    op.create_table(
        "evidence_suggestions",
        sa.Column("id", sa.Uuid(), primary_key=True),
        sa.Column(
            "extraction_id",
            sa.Uuid(),
            sa.ForeignKey("document_extractions.id", ondelete="CASCADE"),
            nullable=False,
        ),
        sa.Column("canonical_skill", sa.String(100), nullable=False),
        sa.Column("category", sa.String(60), nullable=False),
        sa.Column("excerpt", sa.Text(), nullable=False),
        sa.Column("locator", sa.String(80), nullable=False),
        sa.Column("confidence", sa.Float(), nullable=False),
        sa.Column("proposed_level", sa.Integer(), nullable=False),
        sa.Column("review_status", sa.String(20), nullable=False),
        sa.Column("reviewed_at", sa.DateTime(timezone=True)),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
        sa.UniqueConstraint("extraction_id", "canonical_skill"),
    )
    op.create_index("ix_evidence_suggestions_extraction_id", "evidence_suggestions", ["extraction_id"])
    op.create_index("ix_evidence_suggestions_canonical_skill", "evidence_suggestions", ["canonical_skill"])
    op.create_index("ix_evidence_suggestions_review_status", "evidence_suggestions", ["review_status"])


def downgrade() -> None:
    op.drop_table("evidence_suggestions")
    op.drop_table("document_extractions")
