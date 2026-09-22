from sqlalchemy import create_engine, func, select
from sqlalchemy.orm import sessionmaker
from sqlalchemy.pool import StaticPool

from app.database import Base
from app.models import JobChunk, JobPosting, MarketSource
from app.rag import chunk_job_text, index_job_postings, vector_literal
from app.rag_eval import evaluate_retrieval


def test_chunking_is_bounded_and_overlapping() -> None:
    description = " ".join(f"word-{index}" for index in range(400))
    chunks = chunk_job_text("Data Engineer", "Example", description)
    assert len(chunks) == 3
    assert all(chunk.startswith("Data Engineer at Example.") for chunk in chunks)
    assert "word-150" in chunks[0]
    assert "word-150" in chunks[1]


def test_vector_literal_has_stable_precision() -> None:
    assert vector_literal([0.123456789, -0.5]) == "[0.12345679,-0.50000000]"


def test_indexing_skips_unchanged_postings() -> None:
    engine = create_engine("sqlite://", connect_args={"check_same_thread": False}, poolclass=StaticPool)
    Base.metadata.create_all(engine)
    testing_session = sessionmaker(bind=engine, expire_on_commit=False)
    with testing_session() as db:
        source = MarketSource(
            name="Permitted source",
            source_type="manual-permitted",
            permission_basis="Explicit test permission",
            base_url="https://example.com/careers",
        )
        db.add(source)
        db.flush()
        posting = JobPosting(
            source_id=source.id,
            source_url="https://example.com/jobs/1",
            content_hash="a" * 64,
            title="Data Engineer",
            company="Example",
            location="Auckland, New Zealand",
            description="Build reliable Python and SQL pipelines with tests for customer reporting. " * 8,
            role_family="data-engineer",
            seniority="junior",
            classification_confidence=0.8,
        )
        db.add(posting)
        db.commit()

        def fixed_embed(values: list[str]) -> list[list[float]]:
            return [[0.01] * 384 for _ in values]
        first = index_job_postings(db, embed=fixed_embed)
        second = index_job_postings(db, embed=fixed_embed)

        assert first == {"indexed_postings": 1, "skipped_postings": 0, "created_chunks": 1}
        assert second == {"indexed_postings": 0, "skipped_postings": 1, "created_chunks": 0}
        assert db.scalar(select(func.count(JobChunk.id))) == 1
    Base.metadata.drop_all(engine)


def test_evaluation_is_explicit_when_corpus_is_empty() -> None:
    engine = create_engine("sqlite://", connect_args={"check_same_thread": False}, poolclass=StaticPool)
    Base.metadata.create_all(engine)
    testing_session = sessionmaker(bind=engine, expire_on_commit=False)
    with testing_session() as db:
        result = evaluate_retrieval(db)
        assert result["status"] == "insufficient_data"
        assert result["recall_at_k"] is None
    Base.metadata.drop_all(engine)
