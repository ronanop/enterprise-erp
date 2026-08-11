"""Microsoft Graph API email delivery adapter (infrastructure)."""

from __future__ import annotations

from dataclasses import dataclass

import httpx

from core.config import settings


@dataclass(frozen=True)
class GraphSendResult:
    ok: bool
    status_code: int
    message: str
    provider_response: str


class GraphEmailAdapter:
    """Sends mail via Microsoft Graph client-credentials flow."""

    TOKEN_URL = "https://login.microsoftonline.com/{tenant}/oauth2/v2.0/token"
    SEND_URL = "https://graph.microsoft.com/v1.0/users/{sender}/sendMail"

    def __init__(
        self,
        *,
        tenant_id: str | None = None,
        client_id: str | None = None,
        client_secret: str | None = None,
        from_email: str | None = None,
    ) -> None:
        self._tenant_id = (tenant_id or settings.azure_tenant_id).strip()
        self._client_id = (client_id or settings.azure_client_id).strip()
        self._client_secret = (client_secret or settings.azure_client_secret).strip()
        self._from_email = (from_email or settings.azure_from_email).strip()

    @property
    def configured(self) -> bool:
        return bool(self._tenant_id and self._client_id and self._client_secret and self._from_email)

    @property
    def from_email(self) -> str:
        return self._from_email

    def acquire_token(self) -> str:
        if not self.configured:
            raise RuntimeError("Microsoft Graph email is not configured")
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
            raise RuntimeError(f"Graph token error {response.status_code}: {response.text[:500]}")
        token = response.json().get("access_token")
        if not token:
            raise RuntimeError("Graph token response missing access_token")
        return str(token)

    def send_mail(
        self,
        *,
        to_address: str,
        subject: str,
        body_html: str,
        save_to_sent_items: bool = True,
    ) -> GraphSendResult:
        if not to_address.strip():
            return GraphSendResult(
                ok=False,
                status_code=400,
                message="Recipient address is required",
                provider_response="missing_recipient",
            )
        try:
            token = self.acquire_token()
        except Exception as exc:  # noqa: BLE001 — surface provider error to delivery log
            return GraphSendResult(
                ok=False,
                status_code=401,
                message=str(exc),
                provider_response=str(exc)[:2000],
            )

        url = self.SEND_URL.format(sender=self._from_email)
        payload = {
            "message": {
                "subject": subject or "(no subject)",
                "body": {"contentType": "HTML", "content": body_html or ""},
                "toRecipients": [{"emailAddress": {"address": to_address.strip()}}],
            },
            "saveToSentItems": save_to_sent_items,
        }
        headers = {
            "Authorization": f"Bearer {token}",
            "Content-Type": "application/json",
        }
        with httpx.Client(timeout=45.0) as client:
            response = client.post(url, headers=headers, json=payload)

        # Graph sendMail returns 202 Accepted on success
        if response.status_code in (200, 202):
            return GraphSendResult(
                ok=True,
                status_code=response.status_code,
                message="accepted",
                provider_response=response.text[:2000] or f"HTTP {response.status_code}",
            )
        return GraphSendResult(
            ok=False,
            status_code=response.status_code,
            message=f"Graph send failed ({response.status_code})",
            provider_response=response.text[:2000],
        )

    def test_connection(self) -> GraphSendResult:
        """Validate credentials by acquiring a Graph access token."""
        if not self.configured:
            from core.config import settings as app_settings

            diag = app_settings.graph_credential_diagnostics()
            missing = ", ".join(diag["missing"]) or "unknown"
            return GraphSendResult(
                ok=False,
                status_code=503,
                message=f"Azure Graph credentials incomplete. Missing: {missing}",
                provider_response=(
                    f"missing={diag['missing']}; "
                    f"present={diag['present']}; "
                    f"env_files={diag['env_files_found']}; "
                    f"hint={diag['hint']}"
                ),
            )
        try:
            self.acquire_token()
            return GraphSendResult(
                ok=True,
                status_code=200,
                message="Token acquired successfully",
                provider_response=f"from={self._from_email}",
            )
        except Exception as exc:  # noqa: BLE001
            return GraphSendResult(
                ok=False,
                status_code=401,
                message=str(exc),
                provider_response=str(exc)[:2000],
            )
