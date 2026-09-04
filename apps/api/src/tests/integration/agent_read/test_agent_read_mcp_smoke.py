"""Smoke tests for agent read APIs and MCP tool registration."""

import pytest
from fastapi.testclient import TestClient

from main import create_app
from modules.mcp_server.bootstrap import get_mcp_server
from modules.mcp_server.config_loader import load_exposed_endpoints_config
from modules.mcp_server.tool_registry import list_registered_tool_names

STUB_MARKER = "Stub response"


@pytest.fixture
def client() -> TestClient:
    return TestClient(create_app())


def _auth_headers(client: TestClient) -> dict[str, str] | None:
    response = client.post(
        "/api/v1/auth/login",
        json={"email": "admin@example.com", "password": "Secure1!"},
    )
    if response.status_code != 200:
        return None
    token = response.json().get("data", {}).get("access_token")
    if not token:
        return None
    return {"Authorization": f"Bearer {token}"}


@pytest.mark.parametrize(
    ("path", "tool_name"),
    [
        ("/api/v1/leads", "list_leads"),
        ("/api/v1/orders", "list_orders"),
        ("/api/v1/agent/customers", "list_customers"),
        ("/api/v1/invoices", "list_invoices"),
        ("/api/v1/agent/products", "list_products"),
    ],
)
def test_mcp_registers_read_tools(client: TestClient, path: str, tool_name: str) -> None:
    _ = client
    names = list_registered_tool_names(get_mcp_server())
    assert tool_name in names
    assert path in {e.path for e in load_exposed_endpoints_config().endpoints if e.tool_name == tool_name}


@pytest.mark.parametrize(
    "path",
    [
        "/api/v1/leads",
        "/api/v1/orders",
        "/api/v1/agent/customers",
        "/api/v1/invoices",
        "/api/v1/agent/products",
    ],
)
def test_agent_list_endpoints_return_pagination_not_stubs(
    client: TestClient, path: str
) -> None:
    headers = _auth_headers(client)
    if headers is None:
        pytest.skip("Demo login unavailable (database or credentials)")

    response = client.get(path, headers=headers)
    assert response.status_code == 200, response.text
    body = response.json()
    assert body.get("success") is True
    assert "meta" in body
    assert {"total", "limit", "offset"} <= set(body["meta"].keys())
    assert isinstance(body.get("data"), list)
    assert STUB_MARKER not in response.text


def test_list_leads_real_shape(client: TestClient) -> None:
    headers = _auth_headers(client)
    if headers is None:
        pytest.skip("Demo login unavailable")

    response = client.get("/api/v1/leads?limit=5&offset=0", headers=headers)
    assert response.status_code == 200
    body = response.json()
    assert body["meta"]["limit"] == 5
    assert body["meta"]["offset"] == 0
    if body["data"]:
        lead = body["data"][0]
        assert "lead_code" in lead
        assert "id" in lead
