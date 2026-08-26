"""Register MCP tools from allowlist + OpenAPI introspection."""

from __future__ import annotations

import inspect
from typing import Any

from mcp.server.fastmcp import FastMCP
from mcp.types import ToolAnnotations

from modules.mcp_server.config_loader import load_exposed_endpoints_config
from modules.mcp_server.executor import execute_exposed_endpoint
from modules.mcp_server.models import EndpointAccess, ExposedEndpoint
from modules.mcp_server.openapi_schema import (
    access_description_prefix,
    build_input_schema,
    find_openapi_operation,
)


def _make_tool_handler(endpoint: ExposedEndpoint, input_schema: dict[str, Any]):
    properties = input_schema.get("properties", {})
    required = set(input_schema.get("required", []))

    if not properties:

        async def handler() -> dict[str, Any]:
            return await execute_exposed_endpoint(endpoint, {})

        handler.__name__ = endpoint.tool_name
        handler.__doc__ = endpoint.description
        return handler

    parameters: list[inspect.Parameter] = []
    for name in properties:
        default = inspect.Parameter.empty if name in required else None
        parameters.append(
            inspect.Parameter(
                name,
                kind=inspect.Parameter.KEYWORD_ONLY,
                default=default,
                annotation=Any,
            )
        )
    signature = inspect.Signature(parameters, return_annotation=dict[str, Any])

    async def handler(**kwargs: Any) -> dict[str, Any]:
        cleaned = {key: value for key, value in kwargs.items() if value is not None}
        return await execute_exposed_endpoint(endpoint, cleaned)

    handler.__name__ = endpoint.tool_name
    handler.__doc__ = endpoint.description
    handler.__signature__ = signature  # type: ignore[attr-defined]
    return handler


def register_tools_from_openapi(mcp: FastMCP, openapi: dict[str, Any]) -> list[str]:
    """Dynamically attach allowlisted ERP endpoints as MCP tools. Returns tool names."""
    config = load_exposed_endpoints_config()
    registered: list[str] = []

    for entry in config.endpoints:
        if find_openapi_operation(openapi, entry) is None:
            msg = f"OpenAPI operation not found for {entry.method} {entry.path}"
            raise ValueError(msg)

        input_schema = build_input_schema(openapi, entry)
        handler = _make_tool_handler(entry, input_schema)
        description = access_description_prefix(entry.access.value) + entry.description.strip()
        read_only = entry.access == EndpointAccess.READ

        mcp.add_tool(
            handler,
            name=entry.tool_name,
            description=description,
            annotations=ToolAnnotations(
                readOnlyHint=read_only,
                destructiveHint=entry.access == EndpointAccess.WRITE,
            ),
            meta={
                "erp_method": entry.method,
                "erp_path": entry.path,
                "erp_access": entry.access.value,
                "erp_permission": entry.permission,
                "input_schema": input_schema,
            },
        )
        registered.append(entry.tool_name)

    return registered


def list_registered_tool_names(mcp: FastMCP) -> list[str]:
    return [tool.name for tool in mcp._tool_manager.list_tools()]  # noqa: SLF001
