"""Construct and mount the ERP MCP server (streamable HTTP)."""

from __future__ import annotations

from contextlib import asynccontextmanager
from typing import TYPE_CHECKING

from fastapi import FastAPI
from mcp.server.auth.settings import AuthSettings
from mcp.server.fastmcp import FastMCP
from mcp.server.transport_security import TransportSecuritySettings
from starlette.applications import Starlette

from core.config import settings
from modules.mcp_server.auth import mcp_token_verifier
from modules.mcp_server.middleware import McpGatewayMiddleware
from modules.mcp_server.tool_registry import list_registered_tool_names, register_tools_from_openapi

if TYPE_CHECKING:
    from collections.abc import AsyncIterator

_mcp_instance: FastMCP | None = None
_mcp_asgi: Starlette | None = None
_tools_registered = False
_registered_config_version: int | None = None


def get_mcp_server() -> FastMCP:
    global _mcp_instance, _mcp_asgi  # noqa: PLW0603
    if _mcp_instance is not None:
        return _mcp_instance

    verifier = mcp_token_verifier()
    auth_settings = None
    if verifier is not None:
        resource_url = settings.mcp_server_base_url.strip() or f"http://{settings.api_host}:{settings.api_port}/mcp"
        auth_settings = AuthSettings(
            issuer_url=resource_url,
            resource_server_url=resource_url,
            required_scopes=[],
        )

    _mcp_instance = FastMCP(
        name="Enterprise ERP MCP",
        instructions=(
            "Tools expose a curated subset of the Enterprise ERP REST API. "
            "Read-only tools are tagged in descriptions; mutating tools require approval."
        ),
        streamable_http_path="/",
        stateless_http=True,
        token_verifier=verifier,
        auth=auth_settings,
        transport_security=TransportSecuritySettings(enable_dns_rebinding_protection=False),
    )
    _mcp_asgi = _mcp_instance.streamable_http_app()
    return _mcp_instance


def build_mcp_asgi_app() -> Starlette:
    get_mcp_server()
    assert _mcp_asgi is not None
    return McpGatewayMiddleware(_mcp_asgi)


def register_mcp_tools_from_app(fastapi_app: FastAPI) -> list[str]:
    global _tools_registered, _registered_config_version  # noqa: PLW0603
    from modules.mcp_server.config_loader import load_exposed_endpoints_config

    mcp = get_mcp_server()
    config = load_exposed_endpoints_config()
    if _tools_registered and _registered_config_version == config.version:
        return list_registered_tool_names(mcp)

    if _tools_registered:
        for name in list_registered_tool_names(mcp):
            mcp.remove_tool(name)

    openapi = fastapi_app.openapi()
    names = register_tools_from_openapi(mcp, openapi)
    _tools_registered = True
    _registered_config_version = config.version
    return names


@asynccontextmanager
async def mcp_lifespan(_: FastAPI) -> AsyncIterator[None]:
    mcp = get_mcp_server()
    async with mcp.session_manager.run():
        yield


def mount_mcp_on_app(application: FastAPI) -> None:
    """Register tools and mount streamable HTTP transport at /mcp."""
    register_mcp_tools_from_app(application)
    application.mount("/mcp", build_mcp_asgi_app())
