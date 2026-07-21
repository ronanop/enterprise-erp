"""Integration tests for foundation health and routing."""

from unittest.mock import patch

from fastapi.testclient import TestClient

from main import app
from modules.foundation.domain.exceptions import InvalidCredentialsException
from modules.foundation.service.auth_service import AuthService

client = TestClient(app)


def test_health_endpoint_still_available() -> None:
    response = client.get("/api/v1/health")
    assert response.status_code == 200
    assert response.json()["success"] is True


def test_auth_login_invalid_credentials() -> None:
    with patch.object(AuthService, "login", side_effect=InvalidCredentialsException()):
        response = client.post(
            "/api/v1/auth/login",
            json={
                "email": "nobody@example.com",
                "password": "Secure1!",
            },
        )
    assert response.status_code == 401
    assert response.json()["success"] is False
