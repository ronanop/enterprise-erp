"""Microsoft Graph adapter for Teams, SharePoint, OneDrive, and Outlook."""

from __future__ import annotations

from typing import Any

import httpx

from core.config import settings

GRAPH_SCOPE = "https://graph.microsoft.com/.default"
GRAPH_BASE = "https://graph.microsoft.com/v1.0"

CAMPAIGN_FOLDERS = [
    "Content",
    "Designs",
    "Videos",
    "Presentations",
    "Approvals",
    "Reports",
    "Final Assets",
]


class MicrosoftGraphAdapter:
    def credentials_configured(self) -> bool:
        return bool(settings.microsoft_client_id.strip() and settings.microsoft_client_secret.strip())

    def _token(self) -> str | None:
        if not self.credentials_configured():
            return None
        tenant = settings.microsoft_tenant_id.strip() or "common"
        token_url = f"https://login.microsoftonline.com/{tenant}/oauth2/v2.0/token"
        data = {
            "client_id": settings.microsoft_client_id,
            "client_secret": settings.microsoft_client_secret,
            "scope": GRAPH_SCOPE,
            "grant_type": "client_credentials",
        }
        try:
            with httpx.Client(timeout=30.0) as client:
                response = client.post(token_url, data=data)
            response.raise_for_status()
            token = response.json().get("access_token")
            return token if isinstance(token, str) and token else None
        except Exception:
            return None

    def _post(self, token: str, path: str, payload: dict[str, Any]) -> dict[str, Any]:
        with httpx.Client(timeout=45.0) as client:
            response = client.post(
                f"{GRAPH_BASE}{path}",
                headers={"Authorization": f"Bearer {token}", "Content-Type": "application/json"},
                json=payload,
            )
        response.raise_for_status()
        return response.json() if response.content else {}

    def provision_campaign_workspace(self, campaign_name: str) -> dict[str, Any]:
        display = f"Marketing - {campaign_name}"
        intended = {
            "displayName": display,
            "description": f"ERP marketing workspace for {campaign_name}",
            "folders": CAMPAIGN_FOLDERS,
            "mailNickname": "".join(ch if ch.isalnum() else "-" for ch in display.lower())[:64],
        }
        token = self._token()
        if token is None:
            return {
                "provision_status": "queued_offline",
                "display_name": display,
                "folder_structure": {"folders": CAMPAIGN_FOLDERS},
                "graph_payload": intended,
                "last_error": "Microsoft Graph credentials missing or token unavailable",
            }
        try:
            group = self._post(
                token,
                "/groups",
                {
                    "displayName": display,
                    "mailEnabled": False,
                    "mailNickname": intended["mailNickname"][:64] or "mkt-ops",
                    "securityEnabled": False,
                    "groupTypes": ["Unified"],
                    "description": intended["description"],
                },
            )
            return {
                "provision_status": "provisioned",
                "display_name": display,
                "teams_group_id": group.get("id"),
                "teams_web_url": group.get("webUrl"),
                "folder_structure": {"folders": CAMPAIGN_FOLDERS},
                "graph_payload": {"group": group, "intended": intended},
                "last_error": None,
            }
        except Exception as exc:
            return {
                "provision_status": "queued_offline",
                "display_name": display,
                "folder_structure": {"folders": CAMPAIGN_FOLDERS},
                "graph_payload": intended,
                "last_error": str(exc)[:2000],
            }

    def post_teams_notification(self, *, channel_id: str | None, message: str) -> dict[str, Any]:
        token = self._token()
        payload = {"body": {"content": message}}
        if token is None or not channel_id:
            return {"status": "queued_offline", "payload": payload}
        return {"status": "queued_offline", "payload": payload, "note": "channel post requires team path"}

    def create_online_meeting(self, *, subject: str, starts_at: str, ends_at: str, attendees: list[str]) -> dict[str, Any]:
        intended = {
            "subject": subject,
            "start": {"dateTime": starts_at, "timeZone": "UTC"},
            "end": {"dateTime": ends_at, "timeZone": "UTC"},
            "attendees": [{"emailAddress": {"address": e}, "type": "required"} for e in attendees],
            "isOnlineMeeting": True,
            "onlineMeetingProvider": "teamsForBusiness",
        }
        token = self._token()
        if token is None:
            return {"status": "queued_offline", "graph_payload": intended, "join_url": None, "event_id": None}
        try:
            event = self._post(token, "/users", intended)
            return {
                "status": "scheduled",
                "graph_payload": event,
                "join_url": (event.get("onlineMeeting") or {}).get("joinUrl"),
                "event_id": event.get("id"),
            }
        except Exception as exc:
            return {
                "status": "queued_offline",
                "graph_payload": intended,
                "join_url": None,
                "event_id": None,
                "last_error": str(exc)[:2000],
            }
