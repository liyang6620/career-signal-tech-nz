from app.rag import rerank_job_results


def row(title: str, content: str, score: float, source_url: str) -> dict:
    return {"title": title, "content": content, "hybrid_score": score, "source_url": source_url}


def test_reranking_prefers_explicit_role_terms() -> None:
    results = rerank_job_results(
        "Junior Data Engineer skills",
        [
            row("Associate Finance Business Partner", "Strong analytical and data skills", 0.03, "finance"),
            row("Senior Data Engineer", "Build reliable pipelines", 0.02, "data-engineer"),
            row("Junior Fleet Operations Engineer", "Support transport systems", 0.025, "fleet"),
        ],
        3,
    )

    assert [item["source_url"] for item in results] == ["data-engineer", "fleet", "finance"]


def test_reranking_removes_matches_without_meaningful_query_terms() -> None:
    results = rerank_job_results(
        "Python testing",
        [
            row("Data Engineer", "Build Python pipelines and automated tests", 0.02, "relevant"),
            row("Finance Partner", "Budget ownership and forecasting", 0.03, "irrelevant"),
        ],
        8,
    )

    assert [item["source_url"] for item in results] == ["relevant"]
