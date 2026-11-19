"""MailAPI — local Microsoft 365 mailbox proxy (no Graph secrets in ERP).

Base URL example: http://172.16.110.163:3010
Auth: Authorization: Bearer <mailbox api key>  (or X-Api-Key)
"""

from __future__ import annotations

from typing import Any
from urllib.parse import quote

import httpx

from core.config import settings


class MailApiAdapter:
    def __init__(
        self,
        *,
        base_url: str | None = None,
        api_key: str | None = None,
        timeout: float = 120.0,
    ) -> None:
        self._base = (base_url or settings.mailapi_base_url or "").rstrip("/")
        self._api_key = (api_key or settings.mailapi_api_key or "").strip()
        # MailAPI/Graph proxy can be slow on full body — keep a generous read budget.
        self._timeout = httpx.Timeout(timeout, connect=20.0)

    @property
    def configured(self) -> bool:
        return bool(self._base and self._api_key)

    def _headers(self) -> dict[str, str]:
        return {
            "Authorization": f"Bearer {self._api_key}",
            "X-Api-Key": self._api_key,
            "Accept": "application/json",
        }

    def health(self) -> dict[str, Any]:
        with httpx.Client(timeout=httpx.Timeout(8.0, connect=3.0)) as client:
            res = client.get(f"{self._base}/api/health", headers=self._headers())
            res.raise_for_status()
            return res.json()

    def ping(self) -> bool:
        """Fast reachability check before expensive mailbox reads."""
        try:
            with httpx.Client(timeout=httpx.Timeout(4.0, connect=2.0)) as client:
                res = client.get(f"{self._base}/api/health", headers=self._headers())
                return res.status_code < 500
        except Exception:
            return False

    def list_messages(
        self,
        *,
        top: int = 50,
        search: str | None = None,
        unread_only: bool = False,
    ) -> tuple[str, list[dict[str, Any]]]:
        """Return (mailbox_email, messages)."""
        params: dict[str, Any] = {"top": max(1, min(int(top), 100))}
        if search:
            params["search"] = search
        if unread_only:
            params["unread"] = "true"
        with httpx.Client(timeout=self._timeout) as client:
            res = client.get(
                f"{self._base}/api/mailbox/messages",
                headers=self._headers(),
                params=params,
            )
            res.raise_for_status()
            data = res.json()
        mailbox = str(data.get("mailbox") or settings.mailapi_mailbox or "").strip()
        messages = list(data.get("messages") or [])
        if unread_only:
            messages = [m for m in messages if not bool(m.get("isRead"))]
        return mailbox, messages

    def get_message(self, message_id: str) -> tuple[str, dict[str, Any]]:
        """Return (mailbox_email, full message)."""
        enc = quote(message_id, safe="")
        with httpx.Client(timeout=self._timeout) as client:
            res = client.get(
                f"{self._base}/api/mailbox/messages/{enc}",
                headers=self._headers(),
            )
            res.raise_for_status()
            data = res.json()
        mailbox = str(data.get("mailbox") or settings.mailapi_mailbox or "").strip()
        message = data.get("message") or {}
        if not message:
            raise RuntimeError(f"MailAPI returned empty message for id={message_id[:40]}")
        return mailbox, message
