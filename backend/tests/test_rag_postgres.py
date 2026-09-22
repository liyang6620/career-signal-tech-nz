import os

import pytest
from sqlalchemy.orm import Session

from app.database import engine
from app.models import JobChunk, JobPosting, MarketSource
from app.rag import search_job_evidence

pytestmark = pytest.mark.skipif(
    os.getenv("RUN_POSTGRES_TESTS") != "1",
    reason="requires the local pgvector PostgreSQL service",
)


def test_postgres_hybrid_search_returns_filtered_citation() -> None:
    connection = engine.connect()
    transaction = connection.begin()
    try:
        with Session(bind=connection, join_transaction_mode="create_savepoint") as db:
            source = MarketSource(
                name="RAG integration fixture",
                source_type="manual-permitted",
                permission_basis="Test fixture only",
                base_url="https://example.com/careers",
            )
            db.add(source)
            db.flush()
            posting = JobPosting(
                source_id=source.id,
                source_url="https://example.com/rag-fixture",
                content_hash="f" * 64,
                title="Junior Data Engineer",
                company="Example",
                location="Auckland, New Zealand",
                description="Build reliable Python pipelines with automated data quality tests.",
                role_family="data-engineer",
                seniority="junior",
                classification_confidence=0.9,
            )
            db.add(posting)
            db.flush()
            db.add(
                JobChunk(
                    posting_id=posting.id,
                    chunk_index=0,
                    content="Junior Data Engineer at Example. Build reliable Python pipelines and data quality tests.",
                    posting_content_hash=posting.content_hash,
                    embedding_model="BAAI/bge-small-en-v1.5",
                    embedding=[0.01] * 384,
                )
            )
            db.flush()
            results = search_job_evidence(
                db,
                "Python data quality testing",
                [0.01] * 384,
                role_family="data-engineer",
                location="Auckland",
                seniority="junior",
                published_after=None,
                limit=5,
            )
            assert results[0]["source_url"] == "https://example.com/rag-fixture"
    finally:
        transaction.rollback()
        connection.close()
