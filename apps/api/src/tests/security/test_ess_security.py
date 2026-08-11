"""Security tests for ESS endpoints."""

from fastapi.testclient import TestClient

from main import app

client = TestClient(app)

ESS_PATHS = [
    "/api/v1/ess/me",
    "/api/v1/ess/leave-types",
    "/api/v1/ess/leave-balances",
    "/api/v1/ess/leave-requests",
    "/api/v1/ess/attendance",
    "/api/v1/ess/payslips",
]


def test_ess_endpoints_require_auth() -> None:
    for path in ESS_PATHS:
        response = client.get(path)
        assert response.status_code == 401, path
        body = response.json()
        assert body["success"] is False


def test_ess_punch_requires_auth() -> None:
    response = client.post("/api/v1/ess/attendance/punch")
    assert response.status_code == 401
    assert response.json()["success"] is False


def test_ess_create_leave_requires_auth() -> None:
    response = client.post(
        "/api/v1/ess/leave-requests",
        json={
            "leave_type_id": "00000000-0000-0000-0000-000000000001",
            "start_date": "2026-07-01",
            "end_date": "2026-07-02",
            "days_count": "1",
        },
    )
    assert response.status_code == 401


def test_ess_payslip_detail_requires_auth() -> None:
    response = client.get("/api/v1/ess/payslips/00000000-0000-0000-0000-000000000001")
    assert response.status_code == 401


def test_ess_router_mounted() -> None:
    paths = {route.path for route in app.routes}
    assert "/api/v1/ess/me" in paths
    assert "/api/v1/ess/attendance/punch" in paths
    assert "/api/v1/ess/payslips/{payslip_id}" in paths
