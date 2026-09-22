"""Add versioned pgvector job evidence chunks."""

import sqlalchemy as sa
from alembic import op
from pgvector.sqlalchemy import Vector
from sqlalchemy.dialects import postgresql

revision = "20260922_09"
down_revision = "20260922_08"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.execute("CREATE EXTENSION IF NOT EXISTS vector")
    op.create_table(
        "rag_job_chunks",
        sa.Column("id", sa.Uuid(), primary_key=True),
        sa.Column("posting_id", sa.Uuid(), sa.ForeignKey("job_postings.id", ondelete="CASCADE"), nullable=False),
        sa.Column("chunk_index", sa.Integer(), nullable=False),
        sa.Column("content", sa.Text(), nullable=False),
        sa.Column("posting_content_hash", sa.String(64), nullable=False),
        sa.Column("embedding_model", sa.String(120), nullable=False),
        sa.Column("embedding", Vector(384), nullable=False),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
        sa.Column(
            "search_vector",
            postgresql.TSVECTOR(),
            sa.Computed("to_tsvector('english', content)", persisted=True),
            nullable=False,
        ),
        sa.UniqueConstraint("posting_id", "chunk_index"),
    )
    op.create_index("ix_rag_job_chunks_posting_id", "rag_job_chunks", ["posting_id"])
    op.create_index("ix_rag_job_chunks_posting_content_hash", "rag_job_chunks", ["posting_content_hash"])
    op.execute("CREATE INDEX ix_rag_job_chunks_search ON rag_job_chunks USING gin (search_vector)")
    op.execute(
        "CREATE INDEX ix_rag_job_chunks_embedding "
        "ON rag_job_chunks USING hnsw (embedding vector_cosine_ops)"
    )


def downgrade() -> None:
    op.drop_table("rag_job_chunks")
