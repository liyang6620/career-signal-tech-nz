from fastapi.testclient import TestClient

from app.main import app

client = TestClient(app)


def test_health() -> None:
    response = client.get("/health")
    assert response.status_code == 200
    assert response.json()["status"] == "ok"
    assert response.headers.get("x-request-id")


def test_metrics_exposes_low_cardinality_request_series() -> None:
    client.get("/health")
    response = client.get("/metrics")
    assert response.status_code == 200
    assert "careersignal_http_requests_total" in response.text
    assert 'route="/health"' in response.text
    assert "careersignal_queue_depth" in response.text
    assert "careersignal_operational_metrics_available" in response.text


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
