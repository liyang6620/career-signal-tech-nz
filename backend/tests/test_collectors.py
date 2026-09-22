from datetime import UTC, datetime

import pytest
from fastapi.testclient import TestClient
from sqlalchemy import create_engine, select
from sqlalchemy.orm import sessionmaker
from sqlalchemy.pool import StaticPool

from app.collectors import (
    CollectedPosting,
    collect_greenhouse,
    collect_lever,
    collect_schema_org,
    is_new_zealand_location,
)
from app.config import get_settings
from app.database import Base, get_db
from app.main import app
from app.models import CollectorRun, JobPosting


@pytest.fixture
def client() -> TestClient:
    engine = create_engine("sqlite://", connect_args={"check_same_thread": False}, poolclass=StaticPool)
    testing_session = sessionmaker(bind=engine, expire_on_commit=False)
    Base.metadata.create_all(engine)

    def override_db():
        with testing_session() as session:
            yield session

    app.dependency_overrides[get_db] = override_db
    with TestClient(app) as test_client:
        test_client.testing_session = testing_session  # type: ignore[attr-defined]
        yield test_client
    app.dependency_overrides.clear()
    Base.metadata.drop_all(engine)


def test_greenhouse_and_lever_adapters_parse_structured_records(monkeypatch: pytest.MonkeyPatch) -> None:
    monkeypatch.setattr(
        "app.collectors.fetch_json",
        lambda url: {
            "jobs": [
                {
                    "absolute_url": "https://example.com/jobs/1",
                    "title": "Data Engineer",
                    "location": {"name": "Auckland, New Zealand"},
                    "content": "<p>Build reliable Python data pipelines.</p>",
                    "updated_at": "2026-09-20T10:00:00Z",
                }
            ]
        }
        if "greenhouse" in url
        else [
            {
                "hostedUrl": "https://example.com/jobs/2",
                "text": "Software Engineer",
                "categories": {"location": "Wellington"},
                "description": "<p>Build customer-facing software.</p>",
                "additional": "<p>Use TypeScript and React.</p>",
            }
        ],
    )
    greenhouse = collect_greenhouse("valid-board", "Example")
    lever = collect_lever("valid-site", "Example")
    assert greenhouse[0].location == "Auckland, New Zealand"
    assert greenhouse[0].published_at == datetime(2026, 9, 20, 10, tzinfo=UTC)
    assert lever[0].description == "Build customer-facing software. Use TypeScript and React."
    with pytest.raises(ValueError):
        collect_greenhouse("../../invalid", "Example")


def test_schema_org_supports_graph_type_lists_and_multiple_locations(monkeypatch: pytest.MonkeyPatch) -> None:
    html = (
        b'<script type="application/ld+json">{"@graph":[{"@type":["Thing","JobPosting"],'
        b'"url":"https://example.com/jobs/3","title":"AI Engineer",'
        b'"description":"Build and evaluate production AI applications for customers.",'
        b'"datePosted":"2026-09-21","jobLocation":['
        b'{"address":{"addressLocality":"Auckland","addressCountry":"NZ"}},'
        b'{"address":{"addressLocality":"Wellington","addressCountry":"NZ"}}]}]}</script>'
    )

    class Response:
        def __enter__(self):
            return self

        def __exit__(self, *args):
            return None

        def read(self, limit: int) -> bytes:
            return html[:limit]

    monkeypatch.setattr("app.collectors.urlopen", lambda request, timeout: Response())
    posting = collect_schema_org("https://example.com/careers", "Example")[0]
    assert posting.location == "Auckland, NZ; Wellington, NZ"
    assert is_new_zealand_location(posting.location)
    assert not is_new_zealand_location("Sydney, Australia")


def test_collector_management_requires_ingestion_credential(client: TestClient) -> None:
    response = client.post(
        "/api/v1/market/collectors",
        json={
            "name": "Example careers",
            "adapter": "greenhouse",
            "identifier": "example",
            "company": "Example",
            "permission_basis": "Public company board approved for collection",
        },
    )
    assert response.status_code == 401


def create_source(client: TestClient) -> dict:
    response = client.post(
        "/api/v1/market/collectors",
        headers={"X-Ingestion-Key": get_settings().ingestion_api_key},
        json={
            "name": "Example careers",
            "adapter": "greenhouse",
            "identifier": "example",
            "company": "Example",
            "permission_basis": "Public company board approved for collection",
        },
    )
    assert response.status_code == 201
    return response.json()


def test_successful_run_persists_only_valid_nz_postings(client: TestClient, monkeypatch: pytest.MonkeyPatch) -> None:
    source = create_source(client)
    monkeypatch.setattr(
        "app.main.collect",
        lambda *args: [
            CollectedPosting(
                "https://example.com/nz",
                "Data Engineer",
                "Example",
                "Auckland, New Zealand",
                "Build tested Python and SQL data pipelines for customer analytics.",
                datetime.now(UTC),
            ),
            CollectedPosting(
                "https://example.com/au",
                "Data Engineer",
                "Example",
                "Sydney, Australia",
                "Build tested Python and SQL data pipelines for customer analytics.",
                datetime.now(UTC),
            ),
        ],
    )
    response = client.post(
        f"/api/v1/market/collectors/{source['id']}/run",
        headers={"X-Ingestion-Key": get_settings().ingestion_api_key},
    )
    assert response.status_code == 200
    assert response.json()["accepted_count"] == 1
    assert response.json()["rejected_count"] == 1
    with client.testing_session() as db:  # type: ignore[attr-defined]
        assert len(list(db.scalars(select(JobPosting)))) == 1


def test_failed_run_is_retained_for_audit(client: TestClient, monkeypatch: pytest.MonkeyPatch) -> None:
    source = create_source(client)

    def fail(*args):
        raise RuntimeError("upstream unavailable")

    monkeypatch.setattr("app.main.collect", fail)
    response = client.post(
        f"/api/v1/market/collectors/{source['id']}/run",
        headers={"X-Ingestion-Key": get_settings().ingestion_api_key},
    )
    assert response.status_code == 502
    with client.testing_session() as db:  # type: ignore[attr-defined]
        run = db.scalar(select(CollectorRun))
        assert run is not None
        assert run.status == "failed"
        assert run.error_message == "upstream unavailable"
