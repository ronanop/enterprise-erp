"""Unit tests for AssetOperationalStatusService (CR-004)."""

from types import SimpleNamespace
from unittest.mock import MagicMock, patch
from uuid import uuid4

import pytest

from modules.asset.domain.enums import AssetOperationalStatus
from modules.asset.domain.operational_status_exceptions import (
    AssetNotFoundForOperationalStatus,
    InvalidTransition,
    OperationalStatusConflict,
)
from modules.asset.service.asset_operational_status_service import AssetOperationalStatusService
from modules.foundation.domain.value_objects import TenantContext

Ready = AssetOperationalStatus.READY_TO_MOVE.value
Assigned = AssetOperationalStatus.ASSIGNED.value


def _ctx() -> TenantContext:
    return TenantContext(
        tenant_id=uuid4(),
        user_id=uuid4(),
        user_type="employee",
        company_id=uuid4(),
        branch_id=uuid4(),
    )


def _row(*, status=Ready, version=1):
    return SimpleNamespace(
        id=uuid4(),
        operational_status=status,
        version=version,
        updated_at=None,
        updated_by=None,
    )


def test_transition_persists_via_repository() -> None:
    service = AssetOperationalStatusService(MagicMock())
    ctx = _ctx()
    asset_id = uuid4()
    row = _row(status=Ready, version=2)
    with (
        patch.object(service._repo, "lock_for_update", return_value=row),
        patch.object(service._repo, "set_operational_status", return_value=row) as set_status,
        patch.object(service._audit, "log_entity_change"),
    ):
        result = service.transition(ctx, asset_id, target_status=Assigned, expected_version=2)
    assert result == Assigned
    set_status.assert_called_once()


def test_transition_raises_when_asset_missing() -> None:
    service = AssetOperationalStatusService(MagicMock())
    with (
        patch.object(service._repo, "lock_for_update", return_value=None),
        pytest.raises(AssetNotFoundForOperationalStatus),
    ):
        service.transition(_ctx(), uuid4(), target_status=Assigned)


def test_transition_rejects_invalid_before_persist() -> None:
    service = AssetOperationalStatusService(MagicMock())
    row = _row(status=Ready)
    with (
        patch.object(service._repo, "lock_for_update", return_value=row),
        patch.object(service._repo, "set_operational_status") as set_status,
        pytest.raises(InvalidTransition),
    ):
        service.transition(_ctx(), row.id, target_status="RETIRED")
    set_status.assert_not_called()


def test_apply_action_assign() -> None:
    service = AssetOperationalStatusService(MagicMock())
    ctx = _ctx()
    row = _row(status=Ready, version=1)
    with (
        patch.object(service._repo, "lock_for_update", return_value=row),
        patch.object(service._repo, "set_operational_status", return_value=row),
        patch.object(service._audit, "log_entity_change"),
    ):
        assert service.apply_action(ctx, row.id, action="assign") == Assigned


def test_get_status_delegates() -> None:
    service = AssetOperationalStatusService(MagicMock())
    with patch.object(service._repo, "get_operational_status", return_value=Ready) as get_status:
        assert service.get_status(_ctx(), uuid4()) == Ready
    get_status.assert_called_once()


def test_transition_version_conflict_before_persist() -> None:
    service = AssetOperationalStatusService(MagicMock())
    row = _row(status=Ready, version=9)
    with patch.object(service._repo, "lock_for_update", return_value=row):
        with pytest.raises(OperationalStatusConflict):
            service.transition(_ctx(), row.id, target_status=Assigned, expected_version=1)
