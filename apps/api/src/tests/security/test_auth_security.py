"""Security tests for foundation APIs."""

from fastapi.testclient import TestClient

from main import app

client = TestClient(app)


def test_protected_endpoint_requires_auth() -> None:
    response = client.get("/api/v1/users")
    assert response.status_code == 401
    body = response.json()
    assert body["success"] is False


def test_login_validation_error() -> None:
    response = client.post(
        "/api/v1/auth/login",
        json={
            "email": "bad",
            "password": "short",
        },
    )
    assert response.status_code == 422
