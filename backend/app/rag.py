import hashlib
import math
import re
from collections.abc import Callable, Iterable
from functools import lru_cache
from typing import Any

from fastembed import TextEmbedding
from sqlalchemy import delete, select, text
from sqlalchemy.orm import Session

from .config import get_settings
from .models import JobChunk, JobPosting

Embedder = Callable[[list[str]], list[list[float]]]


def chunk_job_text(title: str, company: str, description: str, *, size: int = 180, overlap: int = 30) -> list[str]:
    words = description.split()
    if not words:
        return []
    prefix = f"{title} at {company}. "
    step = max(1, size - overlap)
    return [prefix + " ".join(words[start : start + size]) for start in range(0, len(words), step)]


@lru_cache(maxsize=1)
def embedding_model() -> TextEmbedding:
    settings = get_settings()
    return TextEmbedding(model_name=settings.embedding_model, cache_dir=settings.embedding_cache_path)


def checked_vectors(vectors: Iterable[Any]) -> list[list[float]]:
    values = [vector.tolist() for vector in vectors]
    if any(len(vector) != 384 for vector in values):
        raise RuntimeError("Embedding model returned an unexpected vector dimension")
    return values


def fallback_vectors(values: list[str]) -> list[list[float]]:
    """Keep retrieval usable when the optional ONNX model cannot be downloaded.

    This is deliberately a lexical hashing representation, not an AI embedding.
    Full-text ranking remains the authoritative signal until the local model is available.
    """
    vectors: list[list[float]] = []
    for value in values:
        vector = [0.0] * 384
        for token in value.casefold().split():
            digest = hashlib.sha256(token.encode("utf-8")).digest()
            index = int.from_bytes(digest[:2], "big") % 384
            vector[index] += 1.0 if digest[2] % 2 else -1.0
        norm = math.sqrt(sum(item * item for item in vector)) or 1.0
        vectors.append([item / norm for item in vector])
    return vectors


def embed_passages(values: list[str]) -> list[list[float]]:
    if get_settings().embedding_mode == "hash":
        return fallback_vectors(values)
    try:
        return checked_vectors(embedding_model().passage_embed(values))
    except (RuntimeError, ValueError, OSError):
        return fallback_vectors(values)


def embed_query(value: str) -> list[float]:
    if get_settings().embedding_mode == "hash":
        return fallback_vectors([value])[0]
    try:
        return checked_vectors(embedding_model().query_embed(value))[0]
    except (RuntimeError, ValueError, OSError):
        return fallback_vectors([value])[0]


def index_job_postings(
    db: Session,
    *,
    limit: int = 500,
    embed: Embedder = embed_passages,
) -> dict[str, int]:
    settings = get_settings()
    postings = list(db.scalars(select(JobPosting).order_by(JobPosting.retrieved_at.desc()).limit(limit)))
    indexed = 0
    skipped = 0
    chunk_count = 0
    for posting in postings:
        current = db.scalar(
            select(JobChunk.id).where(
                JobChunk.posting_id == posting.id,
                JobChunk.posting_content_hash == posting.content_hash,
                JobChunk.embedding_model == settings.embedding_model,
            ).limit(1)
        )
        if current:
            skipped += 1
            continue
        chunks = chunk_job_text(posting.title, posting.company, posting.description)
        vectors = embed(chunks) if chunks else []
        if len(chunks) != len(vectors):
            raise RuntimeError("Embedding count did not match chunk count")
        db.execute(delete(JobChunk).where(JobChunk.posting_id == posting.id))
        db.add_all(
            JobChunk(
                posting_id=posting.id,
                chunk_index=index,
                content=content,
                posting_content_hash=posting.content_hash,
                embedding_model=settings.embedding_model,
                embedding=vector,
            )
            for index, (content, vector) in enumerate(zip(chunks, vectors, strict=True))
        )
        indexed += 1
        chunk_count += len(chunks)
    db.commit()
    return {"indexed_postings": indexed, "skipped_postings": skipped, "created_chunks": chunk_count}


def vector_literal(vector: Iterable[float]) -> str:
    return "[" + ",".join(f"{value:.8f}" for value in vector) + "]"


SEARCH_STOP_WORDS = {
    "a", "an", "and", "are", "current", "expectation", "expectations", "for", "hiring",
    "in", "job", "jobs", "market", "of", "or", "requirement", "requirements", "role", "roles",
    "skill", "skills", "the", "to", "what", "with",
}


def rerank_job_results(query: str, rows: list[dict[str, Any]], limit: int) -> list[dict[str, Any]]:
    """Prefer explicit query evidence and keep weak semantic matches out of the result set."""
    query_terms = [
        term for term in re.findall(r"[a-z0-9+#.]+", query.casefold())
        if len(term) > 1 and term not in SEARCH_STOP_WORDS
    ]
    if not query_terms:
        return rows[:limit]

    query_bigrams = {" ".join(query_terms[index : index + 2]) for index in range(len(query_terms) - 1)}
    ranked: list[tuple[float, int, dict[str, Any]]] = []
    for index, row in enumerate(rows):
        title = str(row.get("title") or "").casefold()
        content = str(row.get("content") or "").casefold()
        title_terms = set(re.findall(r"[a-z0-9+#.]+", title))
        content_terms = set(re.findall(r"[a-z0-9+#.]+", content))
        title_overlap = sum(term in title_terms for term in query_terms)
        content_overlap = sum(term in content_terms for term in query_terms)
        phrase_matches = sum(phrase in title for phrase in query_bigrams)
        explicit_score = title_overlap * 5 + min(content_overlap, 4) + phrase_matches * 8
        hybrid_score = float(row.get("hybrid_score") or 0)
        ranked.append((explicit_score + hybrid_score, index, row))

    relevant = [item for item in ranked if item[0] - float(item[2].get("hybrid_score") or 0) > 0]
    if relevant:
        ranked = relevant
    ranked.sort(key=lambda item: (-item[0], item[1]))
    return [row for _, _, row in ranked[:limit]]


HYBRID_SEARCH = text(
    """
    WITH filtered AS (
        SELECT c.id, c.content, c.embedding, c.search_vector,
               j.title, j.company, j.location, j.role_family, j.seniority,
               j.source_url, j.published_at
        FROM rag_job_chunks c
        JOIN job_postings j ON j.id = c.posting_id
        WHERE (CAST(:role_family AS text) IS NULL OR j.role_family = CAST(:role_family AS text))
          AND (CAST(:location AS text) IS NULL OR j.location ILIKE '%' || CAST(:location AS text) || '%')
          AND (CAST(:seniority AS text) IS NULL OR j.seniority = CAST(:seniority AS text))
          AND (
              CAST(:published_after AS timestamptz) IS NULL
              OR j.published_at >= CAST(:published_after AS timestamptz)
          )
    ), lexical AS (
        SELECT id, row_number() OVER (
            ORDER BY ts_rank_cd(search_vector, websearch_to_tsquery('english', :query)) DESC
        ) AS rank
        FROM filtered
        WHERE search_vector @@ websearch_to_tsquery('english', :query)
        LIMIT 30
    ), semantic AS (
        SELECT id, row_number() OVER (ORDER BY embedding <=> CAST(:embedding AS vector)) AS rank
        FROM filtered
        ORDER BY embedding <=> CAST(:embedding AS vector)
        LIMIT 30
    ), fused AS (
        SELECT id, SUM(score) AS hybrid_score
        FROM (
            SELECT id, 1.0 / (60 + rank) AS score FROM lexical
            UNION ALL
            SELECT id, 1.0 / (60 + rank) AS score FROM semantic
        ) ranked
        GROUP BY id
    )
    , ranked_postings AS (
        SELECT f.id, f.content, f.title, f.company, f.location, f.role_family, f.seniority,
               f.source_url, f.published_at, fused.hybrid_score,
               row_number() OVER (
                   PARTITION BY lower(coalesce(f.source_url, f.title || '|' || f.company))
                   ORDER BY fused.hybrid_score DESC, f.id
               ) AS posting_rank
        FROM fused
        JOIN filtered f ON f.id = fused.id
    )
    SELECT id, content, title, company, location, role_family, seniority,
           source_url, published_at, hybrid_score
    FROM ranked_postings
    WHERE posting_rank = 1
    ORDER BY hybrid_score DESC
    LIMIT :result_limit
    """
)


def search_job_evidence(
    db: Session,
    query: str,
    query_embedding: list[float],
    *,
    role_family: str | None,
    location: str | None,
    seniority: str | None,
    published_after: Any,
    limit: int,
) -> list[dict[str, Any]]:
    candidate_limit = min(max(limit * 6, 30), 100)
    rows = db.execute(
        HYBRID_SEARCH,
        {
            "query": query,
            "embedding": vector_literal(query_embedding),
            "role_family": role_family,
            "location": location,
            "seniority": seniority,
            "published_after": published_after,
            "result_limit": candidate_limit,
        },
    ).mappings()
    return rerank_job_results(query, [dict(row) for row in rows], limit)
