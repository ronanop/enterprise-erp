"""MCP transport authentication and ERP permission checks."""

from __future__ import annotations

from uuid import UUID

from mcp.server.auth.provider import AccessToken, TokenVerifier
from mcp.server.fastmcp.exceptions import ToolError

from core.config import settings
from database.session import SessionLocal
from modules.foundation.service.rbac_service import RBACService
from security.jwt import JWTService


class McpStaticTokenVerifier:
    """Validates ElevenLabs integration bearer token (MCP_AUTH_TOKEN)."""

    async def verify_token(self, token: str) -> AccessToken | None:
        expected = settings.mcp_auth_token.strip()
        if not expected:
            return None
        if token != expected:
            return None
        return AccessToken(token=token, client_id="elevenlabs-mcp", scopes=["mcp:connect"])


def mcp_token_verifier() -> TokenVerifier | None:
    if not settings.mcp_auth_token.strip():
        return None
    return McpStaticTokenVerifier()


def assert_erp_permission(access_token: str | None, permission: str | None) -> None:
    if permission is None:
        return
    if not access_token:
        raise ToolError(
            "Missing ERP user token. Send header X-ERP-Access-Token with the user's JWT."
        )
    jwt_service = JWTService()
    try:
        payload = jwt_service.decode_token(access_token, expected_type="access")
    except Exception as exc:
        raise ToolError("Invalid ERP access token") from exc

    user_id = UUID(payload["sub"])
    tenant_id = UUID(payload["tenant_id"])
    with SessionLocal() as db:
        rbac = RBACService(db)
        if not rbac.has_permission(user_id, tenant_id, permission):
            raise ToolError(f"Missing permission: {permission}")
