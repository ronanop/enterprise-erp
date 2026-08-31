"""Repository read support for operational_status (CR-004 Phase 2A)."""

from types import SimpleNamespace
from unittest.mock import MagicMock, patch
from uuid import uuid4

import pytest

from modules.asset.repository.asset_repository import AssetRepository
from modules.foundation.domain.value_objects import TenantContext


def _ctx() -> TenantContext:
    return TenantContext(
        tenant_id=uuid4(),
        user_id=uuid4(),
        user_type="employee",
        company_id=uuid4(),
        branch_id=uuid4(),
    )


def test_get_operational_status_returns_value() -> None:
    repo = AssetRepository(MagicMock())
    ctx = _ctx()
    row_id = uuid4()
    row = SimpleNamespace(operational_status="ASSIGNED")
    with patch.object(repo, "get", return_value=row):
        assert repo.get_operational_status(ctx, row_id) == "ASSIGNED"


def test_get_operational_status_missing_row() -> None:
    repo = AssetRepository(MagicMock())
    with patch.object(repo, "get", return_value=None):
        assert repo.get_operational_status(_ctx(), uuid4()) is None


def test_update_strips_operational_status_writes() -> None:
    repo = AssetRepository(MagicMock())
    ctx = _ctx()
    row_id = uuid4()
    row = SimpleNamespace(
        id=row_id,
        version=1,
        operational_status="READY_TO_MOVE",
        updated_at=None,
        updated_by=None,
    )
    with patch.object(repo, "get", return_value=row):
        repo.update(ctx, row_id, asset_name="Laptop-1", operational_status="ASSIGNED", version=1)
    assert row.operational_status == "READY_TO_MOVE"
    assert row.asset_name == "Laptop-1"


def test_set_operational_status_persists() -> None:
    repo = AssetRepository(MagicMock())
    ctx = _ctx()
    row_id = uuid4()
    row = SimpleNamespace(
        id=row_id,
        version=1,
        operational_status="READY_TO_MOVE",
        updated_at=None,
        updated_by=None,
    )
    with patch.object(repo, "lock_for_update", return_value=row):
        result = repo.set_operational_status(ctx, row_id, "ASSIGNED", expected_version=1)
    assert result is row
    assert row.operational_status == "ASSIGNED"
    assert row.updated_by == ctx.user_id
    assert row.version == 2


def test_set_operational_status_missing_row() -> None:
    repo = AssetRepository(MagicMock())
    with patch.object(repo, "lock_for_update", return_value=None):
        assert repo.set_operational_status(_ctx(), uuid4(), "ASSIGNED") is None


def test_set_operational_status_version_conflict() -> None:
    from modules.asset.domain.operational_status_exceptions import OperationalStatusConflict

    repo = AssetRepository(MagicMock())
    row = SimpleNamespace(id=uuid4(), version=2, operational_status="READY_TO_MOVE", updated_at=None, updated_by=None)
    with patch.object(repo, "lock_for_update", return_value=row):
        with pytest.raises(OperationalStatusConflict):
            repo.set_operational_status(_ctx(), row.id, "ASSIGNED", expected_version=1)
