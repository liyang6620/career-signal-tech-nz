from fastapi.testclient import TestClient

from app.main import app

client = TestClient(app)


def test_health() -> None:
    response = client.get("/health")
    assert response.status_code == 200
    assert response.json()["status"] == "ok"


def test_roles_have_active_and_planned_families() -> None:
    response = client.get("/api/v1/roles")
    assert response.status_code == 200
    assert len(response.json()) >= 6


def test_invalid_evidence_is_rejected() -> None:
    response = client.post(
        "/api/v1/scoring/dimension",
        json={"target_role": "Data Engineer", "seniority": "junior", "evidence": []},
    )
    assert response.status_code == 422
