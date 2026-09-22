"""Security tests for the authenticated notification inbox."""

from fastapi.testclient import TestClient

from main import app

client = TestClient(app)

INBOX_GET_PATHS = [
    "/api/v1/notifications/inbox",
    "/api/v1/notifications/unread-count",
]


def test_inbox_endpoints_require_auth() -> None:
    for path in INBOX_GET_PATHS:
        response = client.get(path)
        assert response.status_code == 401, path
        assert response.json()["success"] is False


def test_mark_read_requires_auth() -> None:
    response = client.post("/api/v1/notifications/read-all")
    assert response.status_code == 401
    response = client.post("/api/v1/notifications/00000000-0000-0000-0000-000000000001/read")
    assert response.status_code == 401
