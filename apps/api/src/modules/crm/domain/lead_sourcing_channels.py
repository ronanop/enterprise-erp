"""Lead hardware/service sourcing channels (mirrors web lead-sourcing-channels.ts)."""

from __future__ import annotations

import json
from typing import Any

HARDWARE_SOURCING_CHANNELS = frozenset({"B2B", "Open Market"})
SERVICE_SOURCING_CHANNELS = frozenset({"Outsourced", "Cache Service"})

SERVICE_CHANNEL_OUTSOURCED = "Outsourced"
SERVICE_CHANNEL_CACHE = "Cache Service"


def parse_service_sourcing_channel(deal_type: str | None) -> str | None:
    """Extract Service Sourcing Channel from lead.deal_type JSON (or None)."""
    raw = (deal_type or "").strip()
    if not raw or not raw.startswith("{"):
        return None
    try:
        parsed: Any = json.loads(raw)
    except (TypeError, ValueError, json.JSONDecodeError):
        return None
    if not isinstance(parsed, dict):
        return None
    service = parsed.get("service")
    if not isinstance(service, str):
        return None
    value = service.strip()
    if value in SERVICE_SOURCING_CHANNELS:
        return value
    return None


def normalize_service_sourcing_channel(value: str | None) -> str | None:
    if value is None:
        return None
    trimmed = value.strip()
    if trimmed in SERVICE_SOURCING_CHANNELS:
        return trimmed
    return None
