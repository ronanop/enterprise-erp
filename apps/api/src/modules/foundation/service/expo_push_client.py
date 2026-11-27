"""Expo Push API client for ExponentPushToken / ExpoPushToken devices."""

from __future__ import annotations

import httpx

EXPO_PUSH_URL = "https://exp.host/--/api/v2/push/send"


def is_expo_push_token(token: str | None) -> bool:
    t = (token or "").strip()
    return t.startswith("ExponentPushToken[") or t.startswith("ExpoPushToken[")


def send_expo_push(
    *,
    token: str,
    title: str,
    body: str,
    data: dict | None = None,
    sound: str = "default",
    priority: str = "high",
    channel_id: str | None = "ess-alerts",
) -> dict:
    """Send one notification via Expo Push. Raises on transport/HTTP errors."""
    message: dict = {
        "to": token.strip(),
        "title": title,
        "body": body,
        "sound": sound,
        "priority": priority,
    }
    if channel_id:
        message["channelId"] = channel_id
    if data:
        message["data"] = {str(k): str(v) for k, v in data.items()}

    with httpx.Client(timeout=15.0) as client:
        resp = client.post(
            EXPO_PUSH_URL,
            headers={
                "Accept": "application/json",
                "Accept-Encoding": "gzip, deflate",
                "Content-Type": "application/json",
            },
            json=message,
        )
        resp.raise_for_status()
        return resp.json()
