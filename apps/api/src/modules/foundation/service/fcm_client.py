"""FCM legacy HTTP push client — active only when FCM_SERVER_KEY is set."""

from __future__ import annotations

import httpx

from core.config import settings


def is_fcm_configured() -> bool:
    return bool(settings.fcm_server_key and settings.fcm_server_key.strip())


def send_fcm_push(
    *,
    token: str,
    title: str,
    body: str,
    data: dict | None = None,
) -> dict:
    """Send via legacy FCM HTTP API. Raises on transport/HTTP errors."""
    if not is_fcm_configured():
        raise RuntimeError("FCM_SERVER_KEY is not configured")
    payload: dict = {
        "to": token,
        "notification": {"title": title, "body": body},
        "priority": "high",
    }
    if data:
        payload["data"] = {str(k): str(v) for k, v in data.items()}
    with httpx.Client(timeout=15.0) as client:
        resp = client.post(
            "https://fcm.googleapis.com/fcm/send",
            headers={
                "Authorization": f"key={settings.fcm_server_key}",
                "Content-Type": "application/json",
            },
            json=payload,
        )
        resp.raise_for_status()
        return resp.json()
