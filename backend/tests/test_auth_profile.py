from uuid import UUID

import pytest
from fastapi.testclient import TestClient
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker
from sqlalchemy.pool import StaticPool

from app.database import Base, get_db
from app.github import GithubSnapshot
from app.main import app
from app.models import DocumentExtraction, EvidenceSuggestion, EvidenceUpload, JobChunk, JobPosting, MarketSource


@pytest.fixture
def client(monkeypatch: pytest.MonkeyPatch) -> TestClient:
    engine = create_engine(
        "sqlite://",
        connect_args={"check_same_thread": False},
        poolclass=StaticPool,
    )
    testing_session = sessionmaker(bind=engine, expire_on_commit=False)
    Base.metadata.create_all(engine)

    def override_db():
        with testing_session() as session:
            yield session

    app.dependency_overrides[get_db] = override_db
    issued_tokens: list[str] = []

    def deterministic_token() -> str:
        token = f"test-token-{len(issued_tokens):064d}"
        issued_tokens.append(token)
        return token

    monkeypatch.setattr("app.main.new_refresh_token", deterministic_token)
    with TestClient(app) as test_client:
        test_client.issued_tokens = issued_tokens  # type: ignore[attr-defined]
        test_client.testing_session = testing_session  # type: ignore[attr-defined]
        yield test_client
    app.dependency_overrides.clear()
    Base.metadata.drop_all(engine)


def register(client: TestClient, email: str = "candidate@example.com", *, verify: bool = True) -> dict:
    token_index = len(client.issued_tokens)  # type: ignore[attr-defined]
    response = client.post(
        "/api/v1/auth/register",
        json={"email": email, "password": "a-secure-password", "display_name": "Candidate"},
    )
    assert response.status_code == 201
    assert response.cookies.get("career_signal_refresh")
    if verify:
        verification = client.post(
            "/api/v1/auth/verify-email",
            json={"token": client.issued_tokens[token_index]},  # type: ignore[attr-defined]
        )
        assert verification.status_code == 204
    return response.json()


def test_registration_hashes_password_and_returns_authenticated_user(client: TestClient) -> None:
    auth = register(client)
    response = client.get("/api/v1/auth/me", headers={"Authorization": f"Bearer {auth['access_token']}"})
    assert response.status_code == 200
    assert response.json()["email"] == "candidate@example.com"
    assert response.json()["is_verified"] is True


def test_unverified_user_cannot_create_profile_and_token_is_single_use(client: TestClient) -> None:
    token_index = len(client.issued_tokens)  # type: ignore[attr-defined]
    auth = register(client, verify=False)
    blocked = client.put(
        "/api/v1/profile",
        headers={"Authorization": f"Bearer {auth['access_token']}"},
        json={"role_family": "software", "location": "Auckland", "seniority": "Graduate / Junior"},
    )
    assert blocked.status_code == 403
    verification_token = client.issued_tokens[token_index]  # type: ignore[attr-defined]
    assert client.post("/api/v1/auth/verify-email", json={"token": verification_token}).status_code == 204
    assert client.post("/api/v1/auth/verify-email", json={"token": verification_token}).status_code == 400


def test_duplicate_registration_and_bad_login_are_rejected(client: TestClient) -> None:
    register(client)
    duplicate = client.post(
        "/api/v1/auth/register",
        json={"email": "candidate@example.com", "password": "another-password", "display_name": "Other"},
    )
    assert duplicate.status_code == 409
    bad_login = client.post(
        "/api/v1/auth/login",
        json={"email": "candidate@example.com", "password": "wrong-password"},
    )
    assert bad_login.status_code == 401


def test_login_is_rate_limited_after_repeated_failures(client: TestClient) -> None:
    register(client)
    for _ in range(5):
        response = client.post(
            "/api/v1/auth/login",
            json={"email": "candidate@example.com", "password": "wrong-password"},
        )
        assert response.status_code == 401
    blocked = client.post(
        "/api/v1/auth/login",
        json={"email": "candidate@example.com", "password": "wrong-password"},
    )
    assert blocked.status_code == 429
    assert blocked.headers["retry-after"] == "900"


def test_password_reset_changes_password(client: TestClient) -> None:
    register(client)
    token_index = len(client.issued_tokens)  # type: ignore[attr-defined]
    requested = client.post("/api/v1/auth/forgot-password", json={"email": "candidate@example.com"})
    assert requested.status_code == 202
    reset_token = client.issued_tokens[token_index]  # type: ignore[attr-defined]
    reset = client.post(
        "/api/v1/auth/reset-password",
        json={"token": reset_token, "password": "a-new-secure-password"},
    )
    assert reset.status_code == 204
    old_login = client.post(
        "/api/v1/auth/login",
        json={"email": "candidate@example.com", "password": "a-secure-password"},
    )
    assert old_login.status_code == 401
    new_login = client.post(
        "/api/v1/auth/login",
        json={"email": "candidate@example.com", "password": "a-new-secure-password"},
    )
    assert new_login.status_code == 200


def test_profile_is_persisted_and_scoped_to_authenticated_user(client: TestClient) -> None:
    first = register(client, "first@example.com")
    token = first["access_token"]
    saved = client.put(
        "/api/v1/profile",
        headers={"Authorization": f"Bearer {token}"},
        json={
            "role_family": "data-engineer",
            "location": "Auckland",
            "seniority": "Graduate / Junior",
            "evidence_sources": [{"source_type": "github", "source_reference": "https://github.com/example"}],
        },
    )
    assert saved.status_code == 200
    persisted = client.get("/api/v1/profile", headers={"Authorization": f"Bearer {token}"})
    assert persisted.status_code == 200
    assert persisted.json()["role_family"] == "data-engineer"
    assert persisted.json()["evidence_sources"][0]["source_type"] == "github"

    second = register(client, "second@example.com")
    missing = client.get(
        "/api/v1/profile",
        headers={"Authorization": f"Bearer {second['access_token']}"},
    )
    assert missing.status_code == 404


def test_account_export_and_deletion(client: TestClient) -> None:
    auth = register(client)
    headers = {"Authorization": f"Bearer {auth['access_token']}"}
    exported = client.get("/api/v1/account/export", headers=headers)
    assert exported.status_code == 200
    assert exported.json()["account"]["email"] == "candidate@example.com"
    assert exported.json()["profile"] is None

    wrong_password = client.request(
        "DELETE",
        "/api/v1/account",
        headers=headers,
        json={"password": "wrong-password"},
    )
    assert wrong_password.status_code == 401
    deleted = client.request(
        "DELETE",
        "/api/v1/account",
        headers=headers,
        json={"password": "a-secure-password"},
    )
    assert deleted.status_code == 204
    login = client.post(
        "/api/v1/auth/login",
        json={"email": "candidate@example.com", "password": "a-secure-password"},
    )
    assert login.status_code == 401


def test_private_upload_is_validated_persisted_and_user_scoped(
    client: TestClient, monkeypatch: pytest.MonkeyPatch
) -> None:
    monkeypatch.setattr("app.main.ensure_bucket", lambda: None)
    monkeypatch.setattr("app.main.presigned_put", lambda key, content_type, size: "http://storage.test/signed")
    monkeypatch.setattr(
        "app.main.object_metadata",
        lambda key: {
            "ContentLength": 128,
            "ContentType": "application/pdf",
            "Metadata": {"expected-size": "128"},
        },
    )
    deleted_keys: list[str] = []
    monkeypatch.setattr("app.main.delete_object", deleted_keys.append)

    first = register(client, "first@example.com")
    headers = {"Authorization": f"Bearer {first['access_token']}"}
    initiated = client.post(
        "/api/v1/evidence/uploads",
        headers=headers,
        json={"filename": "candidate-cv.pdf", "content_type": "application/pdf", "size": 128},
    )
    assert initiated.status_code == 201
    upload_id = initiated.json()["id"]
    completed = client.post(f"/api/v1/evidence/uploads/{upload_id}/complete", headers=headers)
    assert completed.status_code == 200
    assert completed.json()["status"] == "queued_for_scan"
    assert len(client.get("/api/v1/evidence/uploads", headers=headers).json()) == 1

    second = register(client, "second@example.com")
    other_headers = {"Authorization": f"Bearer {second['access_token']}"}
    assert client.post(f"/api/v1/evidence/uploads/{upload_id}/complete", headers=other_headers).status_code == 404
    assert client.delete(f"/api/v1/evidence/uploads/{upload_id}", headers=other_headers).status_code == 404
    assert client.delete(f"/api/v1/evidence/uploads/{upload_id}", headers=headers).status_code == 204
    assert len(deleted_keys) == 1


def test_upload_rejects_mismatched_extension_and_oversized_file(
    client: TestClient, monkeypatch: pytest.MonkeyPatch
) -> None:
    monkeypatch.setattr("app.main.ensure_bucket", lambda: None)
    auth = register(client)
    headers = {"Authorization": f"Bearer {auth['access_token']}"}
    mismatch = client.post(
        "/api/v1/evidence/uploads",
        headers=headers,
        json={"filename": "candidate.docx", "content_type": "application/pdf", "size": 128},
    )
    assert mismatch.status_code == 422
    oversized = client.post(
        "/api/v1/evidence/uploads",
        headers=headers,
        json={"filename": "candidate.pdf", "content_type": "application/pdf", "size": 20 * 1024 * 1024},
    )
    assert oversized.status_code == 413


def test_extracted_evidence_requires_owner_and_complete_review(
    client: TestClient, monkeypatch: pytest.MonkeyPatch
) -> None:
    monkeypatch.setattr("app.main.ensure_bucket", lambda: None)
    monkeypatch.setattr("app.main.presigned_put", lambda key, content_type, size: "http://storage.test/signed")
    deleted_keys: list[str] = []
    monkeypatch.setattr("app.main.delete_object", deleted_keys.append)
    owner = register(client, "owner@example.com")
    headers = {"Authorization": f"Bearer {owner['access_token']}"}
    initiated = client.post(
        "/api/v1/evidence/uploads",
        headers=headers,
        json={"filename": "candidate.pdf", "content_type": "application/pdf", "size": 128},
    )
    upload_id = initiated.json()["id"]
    with client.testing_session() as session:  # type: ignore[attr-defined]
        upload = session.get(EvidenceUpload, UUID(upload_id))
        upload.status = "awaiting_review"
        extraction = DocumentExtraction(
            upload_id=upload.id,
            parser_version="test-v1",
            text_sha256="a" * 64,
            character_count=100,
            page_count=1,
        )
        session.add(extraction)
        session.flush()
        session.add_all(
            [
                EvidenceSuggestion(
                    extraction_id=extraction.id,
                    canonical_skill="Python",
                    category="Programming",
                    excerpt="Built a Python service",
                    locator="line 1",
                    confidence=0.9,
                    proposed_level=3,
                ),
                EvidenceSuggestion(
                    extraction_id=extraction.id,
                    canonical_skill="SQL",
                    category="Data",
                    excerpt="Used SQL for reporting",
                    locator="line 2",
                    confidence=0.75,
                    proposed_level=2,
                ),
            ]
        )
        session.commit()

    extraction_response = client.get(f"/api/v1/evidence/uploads/{upload_id}/extraction", headers=headers)
    assert extraction_response.status_code == 200
    suggestions = extraction_response.json()["suggestions"]
    incomplete = client.post(
        f"/api/v1/evidence/uploads/{upload_id}/review",
        headers=headers,
        json={"decisions": [{"suggestion_id": suggestions[0]["id"], "decision": "confirmed"}]},
    )
    assert incomplete.status_code == 422

    outsider = register(client, "outsider@example.com")
    outsider_headers = {"Authorization": f"Bearer {outsider['access_token']}"}
    assert client.get(f"/api/v1/evidence/uploads/{upload_id}/extraction", headers=outsider_headers).status_code == 404

    reviewed = client.post(
        f"/api/v1/evidence/uploads/{upload_id}/review",
        headers=headers,
        json={
            "decisions": [
                {"suggestion_id": suggestion["id"], "decision": "confirmed" if index == 0 else "rejected"}
                for index, suggestion in enumerate(suggestions)
            ]
        },
    )
    assert reviewed.status_code == 200
    assert reviewed.json()["status"] == "reviewed"
    deleted = client.request(
        "DELETE",
        "/api/v1/account",
        headers=headers,
        json={"password": "a-secure-password"},
    )
    assert deleted.status_code == 204
    assert len(deleted_keys) == 1


def test_public_github_evidence_is_reviewed_and_included_in_fit(
    client: TestClient, monkeypatch: pytest.MonkeyPatch
) -> None:
    monkeypatch.setattr(
        "app.main.fetch_snapshot",
        lambda url: GithubSnapshot(
            owner="candidate",
            repository="api-project",
            canonical_url="https://github.com/candidate/api-project",
            description="Production API",
            default_branch="main",
            stars=3,
            language="Python",
            topics=["fastapi", "docker"],
            readme="Built a FastAPI REST API with Docker and automated testing.",
        ),
    )
    auth = register(client)
    headers = {"Authorization": f"Bearer {auth['access_token']}"}
    created = client.post(
        "/api/v1/evidence/github",
        headers=headers,
        json={"url": "https://github.com/candidate/api-project"},
    )
    assert created.status_code == 201
    project = created.json()
    assert project["status"] == "awaiting_review"
    assert any(item["canonical_skill"] == "FastAPI" for item in project["suggestions"])
    reviewed = client.post(
        f"/api/v1/evidence/github/{project['id']}/review",
        headers=headers,
        json={
            "decisions": [
                {"suggestion_id": item["id"], "decision": "confirmed"}
                for item in project["suggestions"]
            ]
        },
    )
    assert reviewed.status_code == 200
    assert reviewed.json()["status"] == "reviewed"
    fit = client.get("/api/v1/evidence/fit?role_family=ai", headers=headers)
    assert fit.status_code == 200
    assert any(item["evidence_level"] == 2 for item in fit.json()["contributions"])
    graph = client.get("/api/v1/evidence/graph?role_family=ai", headers=headers)
    assert any(item["source_type"] == "github" for item in graph.json()["evidence"])


def test_role_decoder_and_governed_market_import(client: TestClient) -> None:
    auth = register(client)
    headers = {"Authorization": f"Bearer {auth['access_token']}"}
    description = (
        "Build Python data pipelines with SQL, dbt, Airflow and Docker. "
        "Use automated testing and Git in a graduate engineering team."
    )
    decoded = client.post(
        "/api/v1/role-decoder",
        headers=headers,
        json={"title": "Graduate Data Engineer", "description": description},
    )
    assert decoded.status_code == 200
    assert decoded.json()["role_family"] == "data-engineer"
    assert decoded.json()["seniority"] == "graduate"
    payload = {
        "source": {
            "name": "Permitted test feed",
            "source_type": "manual-permitted",
            "permission_basis": "Publisher supplied this record for indexing.",
            "base_url": "https://jobs.example.com",
        },
        "postings": [{
            "source_url": "https://jobs.example.com/roles/1",
            "title": "Graduate Data Engineer",
            "company": "Example Ltd",
            "location": "Auckland",
            "description": description,
        }],
    }
    denied = client.post("/api/v1/market/import", json=payload)
    assert denied.status_code == 401
    imported = client.post(
        "/api/v1/market/import",
        headers={"X-Ingestion-Key": "development-ingestion-key"},
        json=payload,
    )
    assert imported.status_code == 202
    assert imported.json()["imported"] == 1
    summary = client.get("/api/v1/market/summary", headers=headers)
    assert summary.status_code == 200
    assert summary.json()["posting_count"] == 1
    assert summary.json()["roles"][0]["role_family"] == "data-engineer"


def test_evidence_search_returns_source_citations(client: TestClient, monkeypatch: pytest.MonkeyPatch) -> None:
    auth = register(client)
    headers = {"Authorization": f"Bearer {auth['access_token']}"}
    with client.testing_session() as db:  # type: ignore[attr-defined]
        source = MarketSource(
            name="Citation fixture",
            source_type="manual-permitted",
            permission_basis="Test fixture permission",
            base_url="https://jobs.example.com",
        )
        db.add(source)
        db.flush()
        posting = JobPosting(
            source_id=source.id,
            source_url="https://jobs.example.com/1",
            content_hash="c" * 64,
            title="Junior Data Engineer",
            company="Example Ltd",
            location="Auckland",
            description="Build tested Python and SQL pipelines for reporting.",
            role_family="data-engineer",
            seniority="junior",
            classification_confidence=0.8,
        )
        db.add(posting)
        db.flush()
        db.add(
            JobChunk(
                posting_id=posting.id,
                chunk_index=0,
                content=posting.description,
                posting_content_hash=posting.content_hash,
                embedding_model="BAAI/bge-small-en-v1.5",
                embedding=[0.01] * 384,
            )
        )
        db.commit()
    monkeypatch.setattr("app.main.embed_query", lambda value: [0.01] * 384)
    monkeypatch.setattr(
        "app.main.search_job_evidence",
        lambda *args, **kwargs: [
            {
                "title": "Junior Data Engineer",
                "company": "Example Ltd",
                "location": "Auckland",
                "role_family": "data-engineer",
                "seniority": "junior",
                "source_url": "https://jobs.example.com/1",
                "published_at": None,
                "content": "Build tested Python and SQL pipelines for reporting.",
                "hybrid_score": 0.0312,
            }
        ],
    )
    response = client.post(
        "/api/v1/rag/search",
        headers=headers,
        json={"query": "testing expectations", "role_family": "data-engineer"},
    )
    assert response.status_code == 200
    assert response.json()["citations"][0]["citation_id"] == "J1"
    assert response.json()["citations"][0]["source_url"] == "https://jobs.example.com/1"
