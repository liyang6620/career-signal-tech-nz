import pytest
from fastapi.testclient import TestClient
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker
from sqlalchemy.pool import StaticPool

from app.database import Base, get_db
from app.main import app


@pytest.fixture
def client() -> TestClient:
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
    with TestClient(app) as test_client:
        yield test_client
    app.dependency_overrides.clear()
    Base.metadata.drop_all(engine)


def register(client: TestClient, email: str = "candidate@example.com") -> dict:
    response = client.post(
        "/api/v1/auth/register",
        json={"email": email, "password": "a-secure-password", "display_name": "Candidate"},
    )
    assert response.status_code == 201
    assert response.cookies.get("career_signal_refresh")
    return response.json()


def test_registration_hashes_password_and_returns_authenticated_user(client: TestClient) -> None:
    auth = register(client)
    response = client.get("/api/v1/auth/me", headers={"Authorization": f"Bearer {auth['access_token']}"})
    assert response.status_code == 200
    assert response.json()["email"] == "candidate@example.com"


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
