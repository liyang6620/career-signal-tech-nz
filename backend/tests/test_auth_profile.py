import pytest
from fastapi.testclient import TestClient
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker
from sqlalchemy.pool import StaticPool

from app.database import Base, get_db
from app.main import app


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
