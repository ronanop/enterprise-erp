"""Publish truth: a stub post ID is not a published post."""

from __future__ import annotations

from typing import Any


def external_post_id(payload: dict | None) -> str:
    if not isinstance(payload, dict):
        return ""
    return str(payload.get("external_post_id") or "").strip()


def is_live_post_id(value: str | None) -> bool:
    text = (value or "").strip()
    return bool(text) and not text.startswith("stub-")


def is_live_publish(payload: dict | None) -> bool:
    if not isinstance(payload, dict):
        return False
    if payload.get("provider") in {"stub", "awaiting_live_publisher"}:
        return False
    return is_live_post_id(external_post_id(payload))


def public_publish_status(status: str, payload: dict | None) -> str:
    if status == "succeeded" and not is_live_publish(payload):
        return "queued"
    return status
