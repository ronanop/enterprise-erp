"""Microsoft Graph directory adapter (Entra ID users)."""

from __future__ import annotations

from dataclasses import dataclass

import httpx

from core.config import settings
from core.exceptions import AppException


@dataclass(frozen=True)
class GraphDirectoryUser:
    email: str
    display_name: str
    external_id: str


class GraphDirectoryAdapter:
    """Lists organization users via Microsoft Graph client-credentials flow."""

    TOKEN_URL = "https://login.microsoftonline.com/{tenant}/oauth2/v2.0/token"
    USERS_URL = "https://graph.microsoft.com/v1.0/users"

    def __init__(
        self,
        *,
        tenant_id: str | None = None,
        client_id: str | None = None,
        client_secret: str | None = None,
        email_domain: str | None = None,
    ) -> None:
        self._tenant_id = (tenant_id or settings.microsoft_tenant_id).strip()
        self._client_id = (client_id or settings.microsoft_client_id).strip()
        self._client_secret = (client_secret or settings.microsoft_client_secret).strip()
        domain = (email_domain or settings.microsoft_user_email_domain).strip().lower().lstrip("@")
        self._email_domain = domain

    @property
    def configured(self) -> bool:
        return bool(self._tenant_id and self._client_id and self._client_secret)

    @property
    def email_domain(self) -> str:
        return self._email_domain

    def acquire_token(self) -> str:
        if not self.configured:
            raise AppException(
                "Microsoft 365 directory sync is not configured "
                "(MICROSOFT_TENANT_ID / CLIENT_ID / CLIENT_SECRET).",
                status_code=503,
            )
        url = self.TOKEN_URL.format(tenant=self._tenant_id)
        data = {
            "client_id": self._client_id,
            "client_secret": self._client_secret,
            "scope": "https://graph.microsoft.com/.default",
            "grant_type": "client_credentials",
        }
        with httpx.Client(timeout=30.0) as client:
            response = client.post(url, data=data)
        if response.status_code >= 400:
            raise AppException(
                f"Microsoft Graph token error ({response.status_code}): {response.text[:300]}",
                status_code=502,
            )
        token = response.json().get("access_token")
        if not isinstance(token, str) or not token:
            raise AppException("Microsoft Graph token response missing access_token", status_code=502)
        return token

    def list_users_for_domain(self, *, token: str | None = None) -> list[GraphDirectoryUser]:
        access_token = token or self.acquire_token()
        headers = {"Authorization": f"Bearer {access_token}"}
        params: dict[str, str] | None = {
            "$select": "id,displayName,mail,userPrincipalName,accountEnabled",
            "$top": "999",
        }
        rows: list[GraphDirectoryUser] = []
        url: str | None = self.USERS_URL
        with httpx.Client(timeout=60.0) as client:
            while url:
                response = client.get(
                    url,
                    headers=headers,
                    params=params if url == self.USERS_URL else None,
                )
                if response.status_code >= 400:
                    raise AppException(
                        f"Microsoft Graph users error ({response.status_code}): "
                        f"{response.text[:300]}",
                        status_code=502,
                    )
                body = response.json()
                for item in body.get("value", []):
                    if not item.get("accountEnabled", True):
                        continue
                    mail = (item.get("mail") or item.get("userPrincipalName") or "").strip().lower()
                    if not mail or "@" not in mail:
                        continue
                    if self._email_domain and not mail.endswith(f"@{self._email_domain}"):
                        continue
                    rows.append(
                        GraphDirectoryUser(
                            email=mail,
                            display_name=str(item.get("displayName") or mail.split("@", 1)[0]),
                            external_id=str(item.get("id") or ""),
                        )
                    )
                url = body.get("@odata.nextLink")
                params = None
        return rows

    def fetch_user_photo(self, email: str, *, token: str | None = None) -> tuple[bytes, str] | None:
        """Fetch a user's Microsoft profile photo by UPN/email (app permissions)."""
        mail = (email or "").strip()
        if not mail or "@" not in mail:
            return None
        access_token = token or self.acquire_token()
        # Graph accepts UPN in the path; encode @ as %40.
        encoded = mail.replace("@", "%40")
        url = f"https://graph.microsoft.com/v1.0/users/{encoded}/photo/$value"
        headers = {"Authorization": f"Bearer {access_token}"}
        with httpx.Client(timeout=15.0) as client:
            response = client.get(url, headers=headers)
        if response.status_code == 404:
            return None
        if response.status_code >= 400:
            return None
        content_type = response.headers.get("content-type", "image/jpeg").split(";")[0].strip()
        if not content_type.startswith("image/") or not response.content:
            return None
        return response.content, content_type
