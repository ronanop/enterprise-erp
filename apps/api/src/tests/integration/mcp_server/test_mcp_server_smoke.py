"""Smoke tests for MCP dynamic tool registration and ERP delegation."""

from unittest.mock import patch

import httpx
import pytest
from fastapi.testclient import TestClient

from main import create_app
from modules.mcp_server.bootstrap import get_mcp_server
from modules.mcp_server.config_loader import load_exposed_endpoints_config
from modules.mcp_server.executor import execute_exposed_endpoint
from modules.mcp_server.models import ExposedEndpoint
from modules.mcp_server.tool_registry import list_registered_tool_names


@pytest.fixture
def app_client() -> TestClient:
    return TestClient(create_app())


def test_exposed_config_loads() -> None:
    config = load_exposed_endpoints_config()
    assert config.version >= 2
    assert len(config.endpoints) >= 1


def test_mcp_registers_allowlisted_tools(app_client: TestClient) -> None:
    _ = app_client  # ensure app (and MCP mount) initialized
    mcp = get_mcp_server()
    names = list_registered_tool_names(mcp)
    config = load_exposed_endpoints_config()
    expected = {entry.tool_name for entry in config.endpoints}
    assert expected.issubset(set(names))


@pytest.mark.asyncio
async def test_read_only_health_tool_via_executor(app_client: TestClient) -> None:
    health = ExposedEndpoint(
        tool_name="erp_health_check",
        method="GET",
        path="/api/v1/health",
        access="read",
        description="Health check endpoint",
        permission=None,
    )
    transport = httpx.ASGITransport(app=app_client.app)
    real_async_client = httpx.AsyncClient

    class _InProcessAsyncClient:
        def __init__(self, *args, **kwargs):
            kwargs.pop("transport", None)
            self._client = real_async_client(
                transport=transport,
                base_url="http://testserver",
                **kwargs,
            )

        async def __aenter__(self):
            return await self._client.__aenter__()

        async def __aexit__(self, *args):
            return await self._client.__aexit__(*args)

        async def request(self, *args, **kwargs):
            return await self._client.request(*args, **kwargs)

    with patch("modules.mcp_server.executor.httpx.AsyncClient", _InProcessAsyncClient):
        result = await execute_exposed_endpoint(health, {})

    assert result.get("success") is True
    assert result.get("data", {}).get("status") == "healthy"


def test_mcp_mount_route_exists(app_client: TestClient) -> None:
    # Streamable HTTP may reject non-MCP payloads; we only assert the route is mounted.
    response = app_client.post("/mcp/", json={})
    assert response.status_code in {400, 401, 406, 415, 422, 500}
