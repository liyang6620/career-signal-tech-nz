"""Add human retrieval relevance judgements."""

import sqlalchemy as sa
from alembic import op

revision = "20260922_10"
down_revision = "20260922_09"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.create_table(
        "rag_retrieval_judgements",
        sa.Column("id", sa.Uuid(), primary_key=True),
        sa.Column("user_id", sa.Uuid(), sa.ForeignKey("users.id", ondelete="CASCADE"), nullable=False),
        sa.Column("chunk_id", sa.Uuid(), sa.ForeignKey("rag_job_chunks.id", ondelete="CASCADE"), nullable=False),
        sa.Column("query_hash", sa.String(64), nullable=False),
        sa.Column("query_text", sa.String(500), nullable=False),
        sa.Column("role_family", sa.String(80)),
        sa.Column("location", sa.String(120)),
        sa.Column("seniority", sa.String(50)),
        sa.Column("result_rank", sa.Integer(), nullable=False),
        sa.Column("relevant", sa.Boolean(), nullable=False),
        sa.Column("notes", sa.String(500)),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
        sa.UniqueConstraint("user_id", "query_hash", "chunk_id"),
    )
    op.create_index("ix_rag_retrieval_judgements_user_id", "rag_retrieval_judgements", ["user_id"])
    op.create_index("ix_rag_retrieval_judgements_chunk_id", "rag_retrieval_judgements", ["chunk_id"])
    op.create_index("ix_rag_retrieval_judgements_query_hash", "rag_retrieval_judgements", ["query_hash"])


def downgrade() -> None:
    op.drop_table("rag_retrieval_judgements")
