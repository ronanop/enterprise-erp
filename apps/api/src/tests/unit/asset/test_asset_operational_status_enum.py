"""Unit tests for AssetOperationalStatus enum (CR-004 Phase 2A)."""

from modules.asset.domain.enums import (
    ASSET_OPERATIONAL_STATUS_VALUES,
    AssetOperationalStatus,
)


def test_operational_status_values_locked() -> None:
    assert AssetOperationalStatus.READY_TO_MOVE.value == "READY_TO_MOVE"
    assert AssetOperationalStatus.ASSIGNED.value == "ASSIGNED"
    assert AssetOperationalStatus.RETIRED.value == "RETIRED"
    assert AssetOperationalStatus.PENDING_DISPOSAL.value == "PENDING_DISPOSAL"
    assert AssetOperationalStatus.DISPOSED.value == "DISPOSED"
    assert len(AssetOperationalStatus) == 5


def test_operational_status_values_frozenset() -> None:
    assert ASSET_OPERATIONAL_STATUS_VALUES == frozenset(
        {
            "READY_TO_MOVE",
            "ASSIGNED",
            "RETIRED",
            "PENDING_DISPOSAL",
            "DISPOSED",
        }
    )
