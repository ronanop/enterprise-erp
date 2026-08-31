"""CR-004 Phase 2A: deterministic backfill rules for operational_status (no workflows)."""

from __future__ import annotations

from modules.asset.domain.enums import AssetOperationalStatus, AssetStatus


def backfill_operational_status_value(
    lifecycle_status: str,
    *,
    has_active_assignment: bool,
) -> str:
    """Map existing register + assignment data to initial operational_status.

    Does not infer RETIRED or PENDING_DISPOSAL (business workflows only).
    """
    if lifecycle_status in (AssetStatus.DISPOSED.value, AssetStatus.WRITTEN_OFF.value):
        return AssetOperationalStatus.DISPOSED.value
    if has_active_assignment:
        return AssetOperationalStatus.ASSIGNED.value
    return AssetOperationalStatus.READY_TO_MOVE.value
