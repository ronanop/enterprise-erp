"""Unit tests for IncomingAssetService arrive / status rules (Sub-phase 1)."""

from decimal import Decimal
from types import SimpleNamespace
from unittest.mock import MagicMock, patch
from uuid import uuid4

import pytest

from core.exceptions import ConflictException, NotFoundException
from modules.asset.domain.enums import IncomingAssetArrivalStatus
from modules.asset.repository.incoming_asset_repository import compute_arrival_status
from modules.asset.service.incoming_asset_service import IncomingAssetService
from modules.foundation.domain.value_objects import TenantContext


def _ctx(**overrides) -> TenantContext:
    base = dict(
        tenant_id=uuid4(),
        user_id=uuid4(),
        user_type="employee",
        company_id=uuid4(),
        branch_id=uuid4(),
    )
    base.update(overrides)
    return TenantContext(**base)


def test_compute_arrival_status_partial_and_full() -> None:
    assert compute_arrival_status(Decimal("10"), Decimal("0")) == IncomingAssetArrivalStatus.EXPECTED.value
    assert (
        compute_arrival_status(Decimal("10"), Decimal("4"))
        == IncomingAssetArrivalStatus.PARTIALLY_ARRIVED.value
    )
    assert compute_arrival_status(Decimal("10"), Decimal("10")) == IncomingAssetArrivalStatus.ARRIVED.value


def test_search_syncs_then_lists() -> None:
    svc = IncomingAssetService(MagicMock())
    ctx = _ctx()
    rows = [SimpleNamespace(id=uuid4())]
    with (
        patch.object(svc._scope, "resolve_company_id", return_value=ctx.company_id) as resolve,
        patch.object(svc, "_sync_from_procurement") as sync,
        patch.object(svc._repo, "search", return_value=(rows, 1)) as search,
    ):
        items, total = svc.search(ctx, branch_id=ctx.branch_id, offset=0, limit=25)
    resolve.assert_called_once()
    sync.assert_called_once_with(ctx, ctx.company_id, branch_id=ctx.branch_id)
    search.assert_called_once()
    assert total == 1
    assert items == rows


def test_arrive_partial_then_full() -> None:
    svc = IncomingAssetService(MagicMock())
    ctx = _ctx()
    row_id = uuid4()
    line = SimpleNamespace(
        id=row_id,
        branch_id=ctx.branch_id,
        expected_quantity=Decimal("10"),
        arrived_quantity=Decimal("0"),
        grn_id=uuid4(),
        grn_line_id=uuid4(),
        status=IncomingAssetArrivalStatus.EXPECTED.value,
    )
    after_partial = SimpleNamespace(
        id=row_id,
        branch_id=ctx.branch_id,
        expected_quantity=Decimal("10"),
        arrived_quantity=Decimal("4"),
        grn_id=line.grn_id,
        grn_line_id=line.grn_line_id,
        status=IncomingAssetArrivalStatus.PARTIALLY_ARRIVED.value,
        version=2,
    )
    after_full = SimpleNamespace(
        id=row_id,
        branch_id=ctx.branch_id,
        expected_quantity=Decimal("10"),
        arrived_quantity=Decimal("10"),
        grn_id=line.grn_id,
        grn_line_id=line.grn_line_id,
        status=IncomingAssetArrivalStatus.ARRIVED.value,
        version=3,
    )
    with (
        patch.object(svc._repo, "get_for_update", return_value=line),
        patch.object(svc._scope, "validate_branch_access"),
        patch.object(svc._repo, "apply_arrival", return_value=after_partial) as apply,
        patch.object(svc._audit, "log_entity_change") as audit,
        patch.object(svc._repo, "get", return_value=after_partial),
    ):
        result = svc.arrive(ctx, row_id, quantity=4)
    assert result.status == IncomingAssetArrivalStatus.PARTIALLY_ARRIVED.value
    apply.assert_called_once()
    assert apply.call_args.kwargs["quantity"] == Decimal("4")
    audit.assert_called_once()
    assert audit.call_args.kwargs["operation"] == "arrive"

    line.arrived_quantity = Decimal("4")
    with (
        patch.object(svc._repo, "get_for_update", return_value=line),
        patch.object(svc._scope, "validate_branch_access"),
        patch.object(svc._repo, "apply_arrival", return_value=after_full) as apply2,
        patch.object(svc._audit, "log_entity_change"),
        patch.object(svc._repo, "get", return_value=after_full),
    ):
        result2 = svc.arrive(ctx, row_id, mark_all=True)
    assert result2.status == IncomingAssetArrivalStatus.ARRIVED.value
    assert apply2.call_args.kwargs["quantity"] == Decimal("6")


def test_arrive_rejects_over_receive() -> None:
    svc = IncomingAssetService(MagicMock())
    ctx = _ctx()
    row_id = uuid4()
    line = SimpleNamespace(
        id=row_id,
        branch_id=ctx.branch_id,
        expected_quantity=Decimal("10"),
        arrived_quantity=Decimal("8"),
        grn_id=uuid4(),
        grn_line_id=uuid4(),
        status=IncomingAssetArrivalStatus.PARTIALLY_ARRIVED.value,
    )
    with (
        patch.object(svc._repo, "get_for_update", return_value=line),
        patch.object(svc._scope, "validate_branch_access"),
        patch.object(
            svc._repo,
            "apply_arrival",
            side_effect=ValueError("quantity exceeds pending quantity"),
        ),
    ):
        with pytest.raises(ConflictException, match="exceeds pending"):
            svc.arrive(ctx, row_id, quantity=5)


def test_arrive_rejects_already_arrived() -> None:
    svc = IncomingAssetService(MagicMock())
    ctx = _ctx()
    row_id = uuid4()
    line = SimpleNamespace(
        id=row_id,
        branch_id=ctx.branch_id,
        expected_quantity=Decimal("5"),
        arrived_quantity=Decimal("5"),
        status=IncomingAssetArrivalStatus.ARRIVED.value,
    )
    with (
        patch.object(svc._repo, "get_for_update", return_value=line),
        patch.object(svc._scope, "validate_branch_access"),
    ):
        with pytest.raises(ConflictException, match="already fully arrived"):
            svc.arrive(ctx, row_id, quantity=1)


def test_arrive_not_found() -> None:
    svc = IncomingAssetService(MagicMock())
    ctx = _ctx()
    with patch.object(svc._repo, "get_for_update", return_value=None):
        with pytest.raises(NotFoundException):
            svc.arrive(ctx, uuid4(), quantity=1)


def test_apply_arrival_repository_enforces_pending() -> None:
    from modules.asset.repository.incoming_asset_repository import IncomingAssetRepository

    repo = IncomingAssetRepository(MagicMock())
    ctx = _ctx()
    line = SimpleNamespace(
        id=uuid4(),
        expected_quantity=Decimal("10"),
        arrived_quantity=Decimal("9"),
        units=[],
        version=1,
        company_id=ctx.company_id,
    )
    with pytest.raises(ValueError, match="exceeds pending"):
        repo.apply_arrival(ctx, line, quantity=Decimal("2"))


def test_get_isolates_missing_row() -> None:
    svc = IncomingAssetService(MagicMock())
    ctx = _ctx()
    with patch.object(svc._repo, "get", return_value=None):
        with pytest.raises(NotFoundException):
            svc.get(ctx, uuid4())
