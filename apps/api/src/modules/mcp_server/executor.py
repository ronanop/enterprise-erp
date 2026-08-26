"""Execute allowlisted ERP HTTP operations on behalf of MCP tool calls."""

from __future__ import annotations

import re
from typing import Any
from urllib.parse import urlencode

import httpx
from mcp.server.fastmcp.exceptions import ToolError

from core.config import settings
from modules.mcp_server.auth import assert_erp_permission
from modules.mcp_server.models import ExposedEndpoint
from modules.mcp_server.request_context import get_erp_access_token

_PATH_PARAM_PATTERN = re.compile(r"\{([^{}]+)\}")


def _internal_base_url() -> str:
    configured = settings.mcp_server_base_url.strip().rstrip("/")
    if configured:
        return configured
    return f"http://{settings.api_host}:{settings.api_port}"


def _split_path_and_query(path_template: str, arguments: dict[str, Any]) -> tuple[str, dict[str, Any]]:
    remaining = dict(arguments)

    def replacer(match: re.Match[str]) -> str:
        key = match.group(1)
        if key not in remaining:
            msg = f"Missing path parameter: {key}"
            raise ToolError(msg)
        value = remaining.pop(key)
        return str(value)

    resolved = _PATH_PARAM_PATTERN.sub(replacer, path_template)
    return resolved, remaining


async def execute_exposed_endpoint(
    endpoint: ExposedEndpoint,
    arguments: dict[str, Any],
    *,
    erp_access_token: str | None = None,
) -> dict[str, Any]:
    token = erp_access_token or get_erp_access_token()
    assert_erp_permission(token, endpoint.permission)

    path, remaining = _split_path_and_query(endpoint.path, arguments)
    base = _internal_base_url().rstrip("/")
    url = f"{base}{path}"

    headers: dict[str, str] = {"Accept": "application/json"}
    if token:
        headers["Authorization"] = f"Bearer {token}"

    json_body: Any | None = None
    if endpoint.method in {"POST", "PUT", "PATCH"}:
        json_body = remaining if remaining else None

    if endpoint.method == "GET" and remaining:
        url = f"{url}?{urlencode({k: v for k, v in remaining.items() if v is not None})}"

    try:
        async with httpx.AsyncClient(timeout=60.0) as client:
            response = await client.request(
                endpoint.method,
                url,
                headers=headers,
                json=json_body if endpoint.method != "GET" else None,
            )
    except httpx.HTTPError as exc:
        raise ToolError(f"ERP request failed: {exc}") from exc

    try:
        payload = response.json()
    except ValueError:
        payload = {"raw": response.text}

    if response.status_code >= 400:
        message = payload.get("message") if isinstance(payload, dict) else str(payload)
        raise ToolError(f"ERP API error {response.status_code}: {message}")

    return payload if isinstance(payload, dict) else {"data": payload}
