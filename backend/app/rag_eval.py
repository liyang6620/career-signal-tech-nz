import json
from dataclasses import dataclass
from datetime import UTC, datetime, timedelta
from pathlib import Path
from typing import Any

from sqlalchemy import select
from sqlalchemy.orm import Session

from .models import JobChunk
from .rag import embed_query, search_job_evidence


@dataclass(frozen=True)
class EvaluationCase:
    case_id: str
    query: str
    role_family: str
    expected_terms: tuple[str, ...]


def _load_evaluation_cases() -> tuple[EvaluationCase, ...]:
    path = Path(__file__).parents[1] / "evaluation" / "rag_relevance.json"
    if not path.exists():
        path = Path.cwd() / "evaluation" / "rag_relevance.json"
    cases = json.loads(path.read_text(encoding="utf-8"))
    return tuple(EvaluationCase(
        case_id=item["id"],
        query=item["query"],
        role_family=item["role_family"],
        expected_terms=tuple(item["expected_terms"]),
    ) for item in cases)


EVALUATION_CASES = _load_evaluation_cases()


def evaluate_retrieval(db: Session, *, limit: int = 5) -> dict[str, Any]:
    indexed_count = db.scalar(select(JobChunk.id).limit(1))
    if indexed_count is None:
        return {
            "status": "insufficient_data",
            "case_count": len(EVALUATION_CASES),
            "evaluated_cases": 0,
            "recall_at_k": None,
            "mean_reciprocal_rank": None,
            "failures": [],
        }
    recalls: list[float] = []
    reciprocal_ranks: list[float] = []
    failures: list[dict[str, str]] = []
    for case in EVALUATION_CASES:
        rows = search_job_evidence(
            db,
            case.query,
            embed_query(case.query),
            role_family=case.role_family,
            location=None,
            seniority=None,
            published_after=datetime.now(UTC) - timedelta(days=730),
            limit=limit,
        )
        relevant_rank: int | None = None
        for rank, row in enumerate(rows, start=1):
            content = str(row["content"]).casefold()
            if all(term in content for term in case.expected_terms):
                relevant_rank = rank
                break
        recalls.append(1.0 if relevant_rank is not None else 0.0)
        reciprocal_ranks.append(1.0 / relevant_rank if relevant_rank else 0.0)
        if relevant_rank is None:
            failures.append({"case_id": case.case_id, "query": case.query})
    return {
        "status": "ok",
        "case_count": len(EVALUATION_CASES),
        "evaluated_cases": len(EVALUATION_CASES),
        "k": limit,
        "recall_at_k": round(sum(recalls) / len(recalls), 4),
        "mean_reciprocal_rank": round(sum(reciprocal_ranks) / len(reciprocal_ranks), 4),
        "failures": failures,
    }
