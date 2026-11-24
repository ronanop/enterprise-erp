"""Expo Push API client for ExponentPushToken / ExpoPushToken deliveries."""

from __future__ import annotations

import httpx

EXPO_PUSH_URL = "https://exp.host/--/api/v2/push/send"


def is_expo_push_token(token: str | None) -> bool:
    if not token:
        return False
    t = token.strip()
    return t.startswith("ExponentPushToken[") or t.startswith("ExpoPushToken[")


def send_expo_push(
    *,
    token: str,
    title: str,
    body: str,
    data: dict | None = None,
) -> dict:
    """Send one notification via Expo Push API. Raises on transport/HTTP errors."""
    if not is_expo_push_token(token):
        raise RuntimeError("Not an Expo push token")
    message: dict = {
        "to": token.strip(),
        "title": title,
        "body": body,
        "sound": "default",
        "priority": "high",
    }
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
