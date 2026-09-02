"""ASGI middleware for MCP transport auth and ERP user token forwarding."""

from __future__ import annotations

from typing import Any

from starlette.types import ASGIApp, Receive, Scope, Send

from core.config import settings
from modules.mcp_server.request_context import erp_access_token_var


class McpGatewayMiddleware:
    """Validates MCP_AUTH_TOKEN and captures X-ERP-Access-Token for tool handlers."""

    def __init__(self, app: ASGIApp) -> None:
        self.app = app

    async def __call__(self, scope: Scope, receive: Receive, send: Send) -> None:
        if scope["type"] != "http":
            await self.app(scope, receive, send)
            return

        headers = {k.decode().lower(): v.decode() for k, v in scope.get("headers", [])}
        expected = settings.mcp_auth_token.strip()
        if expected:
            auth = headers.get("authorization", "")
            token = auth[7:].strip() if auth.lower().startswith("bearer ") else ""
            if token != expected:
                await self._send_json(send, 401, {"message": "Invalid MCP auth token"})
                return

        erp_token = headers.get("x-erp-access-token")
        if erp_token and erp_token.lower().startswith("bearer "):
            erp_token = erp_token[7:].strip()

        reset = erp_access_token_var.set(erp_token or None)
        try:
            await self.app(scope, receive, send)
        finally:
            erp_access_token_var.reset(reset)

    async def _send_json(self, send: Send, status: int, body: dict[str, Any]) -> None:
        import json

        payload = json.dumps(body).encode()
        await send(
            {
                "type": "http.response.start",
                "status": status,
                "headers": [(b"content-type", b"application/json")],
            }
        )
        await send({"type": "http.response.body", "body": payload})
