"""Read-side operational_status query helpers (CR-004 Phase 2C)."""

from __future__ import annotations

from modules.asset.domain.enums import ASSET_OPERATIONAL_STATUS_VALUES
from modules.asset.domain.operational_status_exceptions import UnknownOperationalStatus


def coerce_operational_status_filter(value: str | None) -> str | None:
    """Normalize list filter; raises UnknownOperationalStatus when invalid."""
    if value is None:
        return None
    normalized = value.strip().upper()
    if not normalized:
        return None
    if normalized not in ASSET_OPERATIONAL_STATUS_VALUES:
        raise UnknownOperationalStatus(f"Invalid operational_status filter: {value!r}")
    return normalized
