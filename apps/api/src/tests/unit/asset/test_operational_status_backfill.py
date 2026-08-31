"""Unit tests for operational_status backfill rules (CR-004 Phase 2A)."""

import pytest

from modules.asset.domain.enums import AssetOperationalStatus, AssetStatus
from modules.asset.domain.operational_status_backfill import backfill_operational_status_value


@pytest.mark.parametrize(
    ("lifecycle", "has_assignment", "expected"),
    [
        (AssetStatus.DISPOSED.value, True, AssetOperationalStatus.DISPOSED.value),
        (AssetStatus.WRITTEN_OFF.value, False, AssetOperationalStatus.DISPOSED.value),
        (AssetStatus.ACTIVE.value, True, AssetOperationalStatus.ASSIGNED.value),
        (AssetStatus.ACTIVE.value, False, AssetOperationalStatus.READY_TO_MOVE.value),
        (AssetStatus.DRAFT.value, False, AssetOperationalStatus.READY_TO_MOVE.value),
        (AssetStatus.DRAFT.value, True, AssetOperationalStatus.ASSIGNED.value),
    ],
)
def test_backfill_operational_status_value(
    lifecycle: str,
    has_assignment: bool,
    expected: str,
) -> None:
    assert (
        backfill_operational_status_value(
            lifecycle,
            has_active_assignment=has_assignment,
        )
        == expected
    )


def test_backfill_does_not_emit_retired_or_pending() -> None:
    for lifecycle in (
        AssetStatus.ACTIVE.value,
        AssetStatus.IN_MAINTENANCE.value,
        AssetStatus.CANCELLED.value,
    ):
        value = backfill_operational_status_value(
            lifecycle,
            has_active_assignment=False,
        )
        assert value not in {
            AssetOperationalStatus.RETIRED.value,
            AssetOperationalStatus.PENDING_DISPOSAL.value,
        }
