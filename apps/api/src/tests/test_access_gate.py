"""Tests for landing access-gate code verification."""

from fastapi.testclient import TestClient


def test_access_gate_rejects_invalid_code(client: TestClient) -> None:
    response = client.post("/api/v1/public/access-gate/verify", json={"code": "WRONG-CODE"})
    assert response.status_code == 401
    body = response.json()
    assert body["success"] is False


def test_access_gate_demo_code(client: TestClient, monkeypatch) -> None:
    from core.config import settings

    monkeypatch.setattr(settings, "access_code_demo", "DEMO-TEST-CODE")
    monkeypatch.setattr(settings, "access_code_connectplus", "CONNECT-TEST-CODE")

    response = client.post(
        "/api/v1/public/access-gate/verify",
        json={"code": "demo-test-code"},
    )
    assert response.status_code == 200
    body = response.json()
    assert body["success"] is True
    assert body["data"]["target"] == "demo"
    assert body["data"]["redirect_path"] == "/demo"
    assert body["data"]["token"]

    session = client.get(
        "/api/v1/public/access-gate/session",
        headers={"Authorization": f"Bearer {body['data']['token']}"},
    )
    assert session.status_code == 200
    assert session.json()["data"]["target"] == "demo"


def test_access_gate_connectplus_code(client: TestClient, monkeypatch) -> None:
    from core.config import settings

    monkeypatch.setattr(settings, "access_code_demo", "DEMO-TEST-CODE")
    monkeypatch.setattr(settings, "access_code_connectplus", "CONNECT-TEST-CODE")

    response = client.post(
        "/api/v1/public/access-gate/verify",
        json={"code": "CONNECT-TEST-CODE"},
    )
    assert response.status_code == 200
    body = response.json()
    assert body["data"]["target"] == "connectplus"
    assert body["data"]["redirect_path"] == "/login"


def test_access_gate_different_length_codes_do_not_500(client: TestClient, monkeypatch) -> None:
    """hmac.compare_digest raises on unequal lengths — must return 401, not 500."""
    from core.config import settings

    monkeypatch.setattr(settings, "access_code_demo", "SHORT")
    monkeypatch.setattr(settings, "access_code_connectplus", "ICP-CONNECT-2026")

    response = client.post(
        "/api/v1/public/access-gate/verify",
        json={"code": "ICP-CONNECT-2026"},
    )
    assert response.status_code == 200
    assert response.json()["data"]["target"] == "connectplus"

    bad = client.post("/api/v1/public/access-gate/verify", json={"code": "NOPE"})
    assert bad.status_code == 401
