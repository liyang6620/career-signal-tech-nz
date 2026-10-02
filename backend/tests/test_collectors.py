from datetime import UTC, datetime, timedelta
from uuid import UUID

import pytest
from fastapi.testclient import TestClient
from sqlalchemy import create_engine, select
from sqlalchemy.orm import sessionmaker
from sqlalchemy.pool import StaticPool

from app.collectors import (
    CollectedPosting,
    collect_ashby,
    collect_greenhouse,
    collect_lever,
    collect_schema_org,
    collect_smartrecruiters,
    collect_workable,
    collect_workday,
    is_new_zealand_location,
)
from app.config import get_settings
from app.database import Base, get_db
from app.main import app
from app.market_ingestion import execute_collector_run
from app.models import CollectorRun, CollectorSource, JobPosting
from app.worker import claim_collector_run, schedule_due_collector_runs


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


def test_ashby_adapter_parses_listed_jobs(monkeypatch: pytest.MonkeyPatch) -> None:
    monkeypatch.setattr(
        "app.collectors.fetch_json",
        lambda url: {
            "jobs": [
                {
                    "jobUrl": "https://jobs.ashbyhq.com/example/1",
                    "title": "Software Engineer",
                    "location": "NZ: Wellington",
                    "descriptionPlain": "Build tested TypeScript services and customer-facing React applications.",
                    "publishedAt": "2026-09-24T09:00:00+12:00",
                    "isListed": True,
                },
                {
                    "jobUrl": "https://jobs.ashbyhq.com/example/2",
                    "title": "Closed role",
                    "location": "Auckland",
                    "descriptionPlain": "This role is no longer available to applicants in New Zealand.",
                    "isListed": False,
                },
            ]
        },
    )
    postings = collect_ashby("example.co", "Example")
    assert len(postings) == 1
    assert postings[0].location == "NZ: Wellington"
    assert postings[0].published_at == datetime.fromisoformat("2026-09-24T09:00:00+12:00")


def test_smartrecruiters_adapter_fetches_full_public_posting(monkeypatch: pytest.MonkeyPatch) -> None:
    def fake_fetch(url: str) -> dict:
        if "?limit=" in url:
            return {
                "totalFound": 1,
                "content": [{"ref": "https://api.smartrecruiters.com/v1/companies/example/postings/1"}],
            }
        return {
            "active": True,
            "visibility": "PUBLIC",
            "name": "Cloud Data Platform Engineer",
            "postingUrl": "https://jobs.smartrecruiters.com/example/1",
            "location": {"fullLocation": "Wellington, New Zealand"},
            "releasedDate": "2026-09-23T03:57:10Z",
            "jobAd": {
                "sections": {
                    "jobDescription": {"text": "<p>Build reliable data platforms.</p>"},
                    "qualifications": {"text": "<p>Python, SQL and cloud experience.</p>"},
                }
            },
        }

    monkeypatch.setattr("app.collectors.fetch_json", fake_fetch)
    posting = collect_smartrecruiters("example", "Example Energy")[0]
    assert posting.location == "Wellington, New Zealand"
    assert posting.description == "Build reliable data platforms. Python, SQL and cloud experience."
    assert posting.published_at == datetime(2026, 9, 23, 3, 57, 10, tzinfo=UTC)


def test_workday_adapter_fetches_job_details_and_rejects_other_hosts(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    monkeypatch.setattr(
        "app.collectors.post_json",
        lambda url, payload: {
            "total": 1,
            "jobPostings": [
                {"title": "Software Engineer", "externalPath": "/job/Auckland-NZ/Software-Engineer_REQ-1"}
            ],
        },
    )
    monkeypatch.setattr(
        "app.collectors.fetch_json",
        lambda url: {
            "jobPostingInfo": {
                "title": "Software Engineer",
                "location": "Auckland, New Zealand",
                "startDate": "2026-09-20",
                "externalUrl": "https://example.wd3.myworkdayjobs.com/jobs/job/1",
                "jobDescription": "<p>Ship tested TypeScript services.</p>",
            }
        },
    )
    posting = collect_workday(
        "https://example.wd3.myworkdayjobs.com/External_Careers",
        "Example",
    )[0]
    assert posting.description == "Ship tested TypeScript services."
    assert posting.location == "Auckland, New Zealand"
    with pytest.raises(ValueError):
        collect_workday("https://example.com/External_Careers", "Example")


def test_workable_adapter_paginates_and_combines_description_fields(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    pages = iter([
        {
            "results": [
                {
                    "shortcode": "ABC123",
                    "title": "Full Stack Engineer",
                    "location": {"countryCode": "NZ"},
                }
            ],
            "nextPage": "token-2",
        },
        {"results": []},
    ])
    monkeypatch.setattr("app.collectors.post_json", lambda url, payload: next(pages))
    monkeypatch.setattr(
        "app.collectors.fetch_json",
        lambda url: {
            "state": "published",
            "isInternal": False,
            "title": "Full Stack Engineer",
            "location": {"city": "Auckland", "region": "Auckland", "country": "New Zealand"},
            "published": "2026-09-21T00:00:00Z",
            "description": "<p>Build cinema software.</p>",
            "requirements": "<p>TypeScript, C# and Azure.</p>",
            "benefits": "<p>Flexible work.</p>",
        },
    )
    posting = collect_workable("vista-group", "Vista Group")[0]
    assert posting.location == "Auckland, Auckland, New Zealand"
    assert posting.description == "Build cinema software. TypeScript, C# and Azure. Flexible work."
    assert posting.source_url == "https://apply.workable.com/vista-group/j/ABC123/"


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


def test_successful_run_is_queued_then_worker_persists_only_valid_nz_postings(
    client: TestClient,
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    source = create_source(client)
    monkeypatch.setattr(
        "app.market_ingestion.collect",
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
            CollectedPosting(
                "https://example.com/marketing",
                "Marketing Manager",
                "Example",
                "Wellington, New Zealand",
                "Lead brand campaigns, events, partnerships and marketing communications across the region.",
                datetime.now(UTC),
            ),
        ],
    )
    response = client.post(
        f"/api/v1/market/collectors/{source['id']}/run",
        headers={"X-Ingestion-Key": get_settings().ingestion_api_key},
    )
    assert response.status_code == 202
    assert response.json()["status"] == "queued"
    run_id = UUID(response.json()["id"])
    with client.testing_session() as db:  # type: ignore[attr-defined]
        queued = db.get(CollectorRun, run_id)
        assert queued is not None
        assert queued.status == "queued"
    monkeypatch.setattr("app.market_ingestion.SessionLocal", client.testing_session)  # type: ignore[attr-defined]
    execute_collector_run(run_id)
    with client.testing_session() as db:  # type: ignore[attr-defined]
        completed = db.get(CollectorRun, run_id)
        assert completed is not None
        assert completed.status == "completed"
        assert completed.fetched_count == 3
        assert completed.accepted_count == 1
        assert completed.rejected_count == 2
        assert len(list(db.scalars(select(JobPosting)))) == 1


def test_failed_run_is_requeued_then_retained_for_audit(
    client: TestClient,
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    source = create_source(client)

    def fail(*args):
        raise RuntimeError("upstream unavailable")

    monkeypatch.setattr("app.market_ingestion.collect", fail)
    response = client.post(
        f"/api/v1/market/collectors/{source['id']}/run",
        headers={"X-Ingestion-Key": get_settings().ingestion_api_key},
    )
    assert response.status_code == 202
    run_id = UUID(response.json()["id"])
    monkeypatch.setattr("app.market_ingestion.SessionLocal", client.testing_session)  # type: ignore[attr-defined]
    execute_collector_run(run_id)
    with client.testing_session() as db:  # type: ignore[attr-defined]
        run = db.get(CollectorRun, run_id)
        assert run is not None
        assert run.status == "queued"
        assert run.error_message == "upstream unavailable"

        # A run that has exhausted its retry budget is retained as failed.
        run.attempts = 3
        db.commit()
    execute_collector_run(run_id)
    with client.testing_session() as db:  # type: ignore[attr-defined]
        run = db.get(CollectorRun, run_id)
        assert run is not None
        assert run.status == "failed"
        assert run.completed_at is not None


def test_worker_claims_queued_collector_run_with_lease(
    client: TestClient,
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    source = create_source(client)
    response = client.post(
        f"/api/v1/market/collectors/{source['id']}/run",
        headers={"X-Ingestion-Key": get_settings().ingestion_api_key},
    )
    assert response.status_code == 202
    run_id = UUID(response.json()["id"])
    monkeypatch.setattr("app.worker.SessionLocal", client.testing_session)  # type: ignore[attr-defined]

    claimed = claim_collector_run()

    assert claimed is not None
    assert claimed.id == run_id
    assert claimed.status == "processing"
    assert claimed.attempts == 1


def test_worker_schedules_due_sources_without_duplicate_runs(
    client: TestClient,
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    source = create_source(client)
    with client.testing_session() as db:  # type: ignore[attr-defined]
        persisted = db.get(CollectorSource, UUID(source["id"]))
        assert persisted is not None
        persisted.next_run_at = datetime.now(UTC) - timedelta(minutes=1)
        db.commit()
    monkeypatch.setattr("app.worker.SessionLocal", client.testing_session)  # type: ignore[attr-defined]

    assert schedule_due_collector_runs() == 1
    assert schedule_due_collector_runs() == 0

    with client.testing_session() as db:  # type: ignore[attr-defined]
        runs = list(db.scalars(select(CollectorRun)))
        persisted = db.get(CollectorSource, UUID(source["id"]))
        assert len(runs) == 1
        assert runs[0].status == "queued"
        assert persisted is not None
        assert persisted.last_enqueued_at is not None
        assert persisted.next_run_at > persisted.last_enqueued_at
