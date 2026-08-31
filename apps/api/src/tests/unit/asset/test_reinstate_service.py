"""Phase 5E — Reinstate (PENDING_DISPOSAL → READY_TO_MOVE) unit tests."""

from contextlib import ExitStack
from types import SimpleNamespace
from unittest.mock import MagicMock, patch
from uuid import uuid4

import pytest

from core.exceptions import NotFoundException
from modules.asset.domain.enums import AssetOperationalStatus
from modules.asset.domain.exceptions import ReinstateValidationError
from modules.asset.domain.operational_status_exceptions import InvalidTransition
from modules.asset.service.reinstate_service import ReinstateService
from modules.foundation.domain.value_objects import TenantContext

Ready = AssetOperationalStatus.READY_TO_MOVE.value
Assigned = AssetOperationalStatus.ASSIGNED.value
Retired = AssetOperationalStatus.RETIRED.value
Pending = AssetOperationalStatus.PENDING_DISPOSAL.value
Disposed = AssetOperationalStatus.DISPOSED.value


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


def _asset(*, ops=Pending, status="active", company_id=None):
    return SimpleNamespace(
        id=uuid4(),
        company_id=company_id or uuid4(),
        status=status,
        operational_status=ops,
        version=1,
        asset_code="AST-0001",
        asset_name="Dell Latitude",
    )


def _patch_clear(svc: ReinstateService, stack: ExitStack) -> None:
    stack.enter_context(
        patch.object(svc._assignments, "find_pending_or_active_for_asset", return_value=None)
    )
    stack.enter_context(
        patch.object(svc._assignment_components, "list_issued_for_asset", return_value=[])
    )
    stack.enter_context(patch.object(svc._transfers, "find_pending_for_asset", return_value=None))
    stack.enter_context(patch.object(svc._maintenances, "find_open_for_asset", return_value=None))
    stack.enter_context(patch.object(svc._disposals, "find_pending_for_asset", return_value=None))


def test_reinstate_success() -> None:
    svc = ReinstateService(MagicMock())
    ctx = _ctx()
    asset = _asset(company_id=ctx.company_id)
    ready_asset = SimpleNamespace(**{**asset.__dict__, "operational_status": Ready})
    with ExitStack() as stack:
        stack.enter_context(patch.object(svc._assets, "lock_for_update", return_value=asset))
        stack.enter_context(patch.object(svc._assets, "get", return_value=ready_asset))
        apply_action = stack.enter_context(
            patch.object(svc._operational, "apply_action", return_value=Ready)
        )
        _patch_clear(svc, stack)
        result = svc.reinstate(ctx, asset.id, remarks="inspected OK")
    assert result.operational_status == Ready
    assert result.status == "active"
    kwargs = apply_action.call_args.kwargs
    assert kwargs["action"] == "reinstate"
    assert kwargs["reason"] == "reinstate"
    assert kwargs["remarks"] == "inspected OK"


@pytest.mark.parametrize(
    ("ops", "match"),
    [
        (Ready, "already ready to move"),
        (Assigned, "Assigned assets cannot be reinstated"),
        (Retired, "Retired assets cannot be reinstated"),
        (Disposed, "already been disposed"),
        (None, "PENDING_DISPOSAL"),
    ],
)
def test_reinstate_requires_pending(ops: str | None, match: str) -> None:
    svc = ReinstateService(MagicMock())
    ctx = _ctx()
    asset = _asset(ops=ops, company_id=ctx.company_id)
    with (
        patch.object(svc._assets, "lock_for_update", return_value=asset),
        patch.object(svc._operational, "apply_action") as apply_action,
        pytest.raises(ReinstateValidationError, match=match),
    ):
        svc.reinstate(ctx, asset.id)
    apply_action.assert_not_called()


@pytest.mark.parametrize(
    ("life", "match"),
    [
        ("disposed", "already been disposed"),
        ("written_off", "Written-off"),
        ("cancelled", "Cancelled"),
        ("draft", "active or in_maintenance"),
    ],
)
def test_reinstate_blocks_invalid_lifecycle(life: str, match: str) -> None:
    svc = ReinstateService(MagicMock())
    ctx = _ctx()
    asset = _asset(status=life, company_id=ctx.company_id)
    with (
        patch.object(svc._assets, "lock_for_update", return_value=asset),
        pytest.raises(ReinstateValidationError, match=match),
    ):
        svc.reinstate(ctx, asset.id)


def test_reinstate_blocks_active_assignment() -> None:
    svc = ReinstateService(MagicMock())
    ctx = _ctx()
    asset = _asset(company_id=ctx.company_id)
    with (
        patch.object(svc._assets, "lock_for_update", return_value=asset),
        patch.object(
            svc._assignments,
            "find_pending_or_active_for_asset",
            return_value=SimpleNamespace(document_number="AASN-1"),
        ),
        pytest.raises(ReinstateValidationError, match="while it is assigned"),
    ):
        svc.reinstate(ctx, asset.id)


def test_reinstate_blocks_issued_components() -> None:
    svc = ReinstateService(MagicMock())
    ctx = _ctx()
    asset = _asset(company_id=ctx.company_id)
    with (
        patch.object(svc._assets, "lock_for_update", return_value=asset),
        patch.object(svc._assignments, "find_pending_or_active_for_asset", return_value=None),
        patch.object(
            svc._assignment_components,
            "list_issued_for_asset",
            return_value=[SimpleNamespace(id=uuid4())],
        ),
        pytest.raises(ReinstateValidationError, match="active components"),
    ):
        svc.reinstate(ctx, asset.id)


def test_reinstate_blocks_open_disposal() -> None:
    svc = ReinstateService(MagicMock())
    ctx = _ctx()
    asset = _asset(company_id=ctx.company_id)
    with ExitStack() as stack:
        stack.enter_context(patch.object(svc._assets, "lock_for_update", return_value=asset))
        stack.enter_context(
            patch.object(svc._assignments, "find_pending_or_active_for_asset", return_value=None)
        )
        stack.enter_context(
            patch.object(svc._assignment_components, "list_issued_for_asset", return_value=[])
        )
        stack.enter_context(patch.object(svc._transfers, "find_pending_for_asset", return_value=None))
        stack.enter_context(patch.object(svc._maintenances, "find_open_for_asset", return_value=None))
        stack.enter_context(
            patch.object(
                svc._disposals,
                "find_pending_for_asset",
                return_value=SimpleNamespace(document_number="ADSP-1"),
            )
        )
        with pytest.raises(ReinstateValidationError, match="Cancel the open disposal"):
            svc.reinstate(ctx, asset.id)


def test_reinstate_blocks_transfer_and_maintenance() -> None:
    svc = ReinstateService(MagicMock())
    ctx = _ctx()
    asset = _asset(company_id=ctx.company_id)
    with (
        patch.object(svc._assets, "lock_for_update", return_value=asset),
        patch.object(svc._assignments, "find_pending_or_active_for_asset", return_value=None),
        patch.object(svc._assignment_components, "list_issued_for_asset", return_value=[]),
        patch.object(
            svc._transfers,
            "find_pending_for_asset",
            return_value=SimpleNamespace(document_number="ATRF-1"),
        ),
        pytest.raises(ReinstateValidationError, match="transfer is in progress"),
    ):
        svc.reinstate(ctx, asset.id)

    with (
        patch.object(svc._assets, "lock_for_update", return_value=asset),
        patch.object(svc._assignments, "find_pending_or_active_for_asset", return_value=None),
        patch.object(svc._assignment_components, "list_issued_for_asset", return_value=[]),
        patch.object(svc._transfers, "find_pending_for_asset", return_value=None),
        patch.object(
            svc._maintenances,
            "find_open_for_asset",
            return_value=SimpleNamespace(document_number="AMNT-1"),
        ),
        pytest.raises(ReinstateValidationError, match="maintenance"),
    ):
        svc.reinstate(ctx, asset.id)


def test_reinstate_not_found() -> None:
    svc = ReinstateService(MagicMock())
    with (
        patch.object(svc._assets, "lock_for_update", return_value=None),
        pytest.raises(NotFoundException),
    ):
        svc.reinstate(_ctx(), uuid4())


def test_concurrent_reinstate_second_fails() -> None:
    svc = ReinstateService(MagicMock())
    ctx = _ctx()
    asset = _asset(company_id=ctx.company_id)
    after = SimpleNamespace(**{**asset.__dict__, "operational_status": Ready})
    call_count = {"n": 0}

    def lock_side_effect(*_a, **_k):
        call_count["n"] += 1
        return asset if call_count["n"] == 1 else after

    with ExitStack() as stack:
        stack.enter_context(
            patch.object(svc._assets, "lock_for_update", side_effect=lock_side_effect)
        )
        stack.enter_context(patch.object(svc._assets, "get", return_value=after))
        apply_action = stack.enter_context(
            patch.object(svc._operational, "apply_action", return_value=Ready)
        )
        _patch_clear(svc, stack)
        first = svc.reinstate(ctx, asset.id)
        with pytest.raises(ReinstateValidationError, match="already ready to move"):
            svc.reinstate(ctx, asset.id)
    assert first.operational_status == Ready
    assert apply_action.call_count == 1


def test_reinstate_maps_invalid_transition() -> None:
    svc = ReinstateService(MagicMock())
    ctx = _ctx()
    asset = _asset(company_id=ctx.company_id)
    raced = SimpleNamespace(**{**asset.__dict__, "operational_status": Ready})
    with ExitStack() as stack:
        stack.enter_context(patch.object(svc._assets, "lock_for_update", return_value=asset))
        stack.enter_context(patch.object(svc._assets, "get", return_value=raced))
        stack.enter_context(
            patch.object(
                svc._operational,
                "apply_action",
                side_effect=InvalidTransition("already READY"),
            )
        )
        _patch_clear(svc, stack)
        with pytest.raises(ReinstateValidationError, match="already ready to move"):
            svc.reinstate(ctx, asset.id)


def test_ops_service_reinstate_from_pending() -> None:
    from modules.asset.service.asset_operational_status_service import (
        AssetOperationalStatusService,
    )

    service = AssetOperationalStatusService(MagicMock())
    ctx = _ctx()
    row = SimpleNamespace(id=uuid4(), operational_status=Pending, version=1)
    with (
        patch.object(service._repo, "lock_for_update", return_value=row),
        patch.object(service._repo, "set_operational_status", return_value=row) as set_status,
        patch.object(service._audit, "log_entity_change") as audit,
    ):
        result = service.apply_action(ctx, row.id, action="reinstate", reason="reinstate")
    assert result == Ready
    set_status.assert_called_once()
    audit.assert_called_once()


def test_ops_service_blocks_reinstate_from_retired() -> None:
    from modules.asset.service.asset_operational_status_service import (
        AssetOperationalStatusService,
    )

    service = AssetOperationalStatusService(MagicMock())
    row = SimpleNamespace(id=uuid4(), operational_status=Retired, version=1)
    with (
        patch.object(service._repo, "lock_for_update", return_value=row),
        patch.object(service._repo, "set_operational_status") as set_status,
        pytest.raises(InvalidTransition),
    ):
        service.apply_action(_ctx(), row.id, action="reinstate")
    set_status.assert_not_called()
