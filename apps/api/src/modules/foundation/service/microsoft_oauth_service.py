"""Microsoft Entra ID (Azure AD) OAuth2 / OpenID Connect helpers."""

from __future__ import annotations

import secrets
from typing import Any
from urllib.parse import urlencode

import httpx
import jwt
from jwt import PyJWKClient

from core.config import settings
from modules.foundation.domain.exceptions import MicrosoftLoginNotConfiguredException


class MicrosoftOAuthService:
    SCOPES = ("openid", "profile", "email", "offline_access")

    def __init__(self) -> None:
        self._ensure_configured()

    @staticmethod
    def is_enabled() -> bool:
        return settings.microsoft_login_enabled

    def _ensure_configured(self) -> None:
        if not self.is_enabled():
            raise MicrosoftLoginNotConfiguredException()

    @property
    def _tenant(self) -> str:
        tenant = settings.microsoft_tenant_id.strip()
        return tenant or "common"

    @property
    def _authority(self) -> str:
        return f"https://login.microsoftonline.com/{self._tenant}"

    def create_state(self) -> str:
        return secrets.token_urlsafe(32)

    def create_exchange_code(self) -> str:
        return secrets.token_urlsafe(32)

    def build_authorization_url(self, *, state: str) -> str:
        params = {
            "client_id": settings.microsoft_client_id,
            "response_type": "code",
            "redirect_uri": settings.microsoft_redirect_uri,
            "response_mode": "query",
            "scope": " ".join(self.SCOPES),
            "state": state,
        }
        return f"{self._authority}/oauth2/v2.0/authorize?{urlencode(params)}"

    def exchange_authorization_code(self, code: str) -> dict[str, Any]:
        token_url = f"{self._authority}/oauth2/v2.0/token"
        data = {
            "client_id": settings.microsoft_client_id,
            "client_secret": settings.microsoft_client_secret,
            "grant_type": "authorization_code",
            "code": code,
            "redirect_uri": settings.microsoft_redirect_uri,
            "scope": " ".join(self.SCOPES),
        }
        with httpx.Client(timeout=20.0) as client:
            response = client.post(token_url, data=data)
        if response.status_code >= 400:
            raise MicrosoftLoginNotConfiguredException("Microsoft token exchange failed")
        payload = response.json()
        id_token = payload.get("id_token")
        if not isinstance(id_token, str) or not id_token:
            raise MicrosoftLoginNotConfiguredException("Microsoft did not return an ID token")
        return self.decode_id_token(id_token)

    def decode_id_token(self, id_token: str) -> dict[str, Any]:
        metadata_url = f"{self._authority}/v2.0/.well-known/openid-configuration"
        with httpx.Client(timeout=20.0) as client:
            metadata = client.get(metadata_url).json()
        jwks_uri = metadata.get("jwks_uri")
        if not isinstance(jwks_uri, str):
            raise MicrosoftLoginNotConfiguredException("Microsoft JWKS metadata unavailable")

        jwk_client = PyJWKClient(jwks_uri)
        signing_key = jwk_client.get_signing_key_from_jwt(id_token)
        issuer = metadata.get("issuer")
        if not isinstance(issuer, str) or not issuer:
            raise MicrosoftLoginNotConfiguredException("Microsoft issuer metadata unavailable")
        # Microsoft Entra ID id_tokens are RS256-signed; algorithm is fixed by issuer metadata.
        decoded = jwt.decode(
            id_token,
            signing_key.key,
            algorithms=["RS256"],
            audience=settings.microsoft_client_id,
            issuer=issuer,
        )
        return decoded

    @staticmethod
    def email_from_claims(claims: dict[str, Any]) -> str | None:
        for key in ("preferred_username", "email", "upn"):
            value = claims.get(key)
            if isinstance(value, str) and "@" in value:
                return value.strip().lower()
        return None
