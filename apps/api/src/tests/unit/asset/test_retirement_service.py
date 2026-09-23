"""Phase 5D — Start Disposal (RETIRED → PENDING_DISPOSAL) unit tests."""

from contextlib import ExitStack
from types import SimpleNamespace
from unittest.mock import MagicMock, patch
from uuid import uuid4

import pytest

from core.exceptions import NotFoundException
from modules.asset.domain.enums import AssetOperationalStatus
from modules.asset.domain.exceptions import RetirementValidationError
from modules.asset.domain.operational_status_exceptions import InvalidTransition
from modules.asset.service.retirement_service import RetirementService
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


def _asset(*, ops=Retired, status="active", company_id=None, version=1):
    return SimpleNamespace(
        id=uuid4(),
        company_id=company_id or uuid4(),
        status=status,
        operational_status=ops,
        version=version,
        asset_code="AST-0001",
        asset_name="Dell Latitude",
    )


def _patch_clear(svc: RetirementService, stack: ExitStack) -> None:
    stack.enter_context(
        patch.object(svc._assignments, "find_pending_or_active_for_asset", return_value=None)
    )
    stack.enter_context(
        patch.object(svc._assignment_components, "list_issued_for_asset", return_value=[])
    )
    stack.enter_context(patch.object(svc._transfers, "find_pending_for_asset", return_value=None))
    stack.enter_context(patch.object(svc._maintenances, "find_open_for_asset", return_value=None))
    stack.enter_context(patch.object(svc._disposals, "find_pending_for_asset", return_value=None))


def test_start_disposal_success() -> None:
    svc = RetirementService(MagicMock())
    ctx = _ctx()
    asset = _asset(company_id=ctx.company_id)
    pending_asset = SimpleNamespace(**{**asset.__dict__, "operational_status": Pending})
    with ExitStack() as stack:
        stack.enter_context(patch.object(svc._assets, "lock_for_update", return_value=asset))
        stack.enter_context(patch.object(svc._assets, "get", return_value=pending_asset))
        apply_action = stack.enter_context(
            patch.object(svc._operational, "apply_action", return_value=Pending)
        )
        _patch_clear(svc, stack)
        result = svc.start_disposal(ctx, asset.id, remarks="scrap queue")
    assert result.operational_status == Pending
    apply_action.assert_called_once()
    kwargs = apply_action.call_args.kwargs
    assert kwargs["action"] == "start_disposal"
    assert kwargs["reason"] == "start_disposal"
    assert kwargs["remarks"] == "scrap queue"


@pytest.mark.parametrize(
    ("ops", "match"),
    [
        (Ready, "must be RETIRED"),
        (Assigned, "must be RETIRED"),
        (Pending, "already pending disposal"),
        (Disposed, "already been disposed"),
        (None, "must be RETIRED"),
    ],
)
def test_start_disposal_requires_retired(ops: str | None, match: str) -> None:
    svc = RetirementService(MagicMock())
    ctx = _ctx()
    asset = _asset(ops=ops, company_id=ctx.company_id)
    with (
        patch.object(svc._assets, "lock_for_update", return_value=asset),
        patch.object(svc._operational, "apply_action") as apply_action,
        pytest.raises(RetirementValidationError, match=match),
    ):
        svc.start_disposal(ctx, asset.id)
    apply_action.assert_not_called()


@pytest.mark.parametrize(
    ("life", "match"),
    [
        ("disposed", "already been disposed"),
        ("written_off", "Written-off"),
        ("cancelled", "Cancelled"),
    ],
)
def test_start_disposal_blocks_terminal_lifecycle(life: str, match: str) -> None:
    svc = RetirementService(MagicMock())
    ctx = _ctx()
    asset = _asset(status=life, company_id=ctx.company_id)
    with (
        patch.object(svc._assets, "lock_for_update", return_value=asset),
        pytest.raises(RetirementValidationError, match=match),
    ):
        svc.start_disposal(ctx, asset.id)


def test_start_disposal_blocks_active_assignment() -> None:
    svc = RetirementService(MagicMock())
    ctx = _ctx()
    asset = _asset(company_id=ctx.company_id)
    with (
        patch.object(svc._assets, "lock_for_update", return_value=asset),
        patch.object(
            svc._assignments,
            "find_pending_or_active_for_asset",
            return_value=SimpleNamespace(document_number="AASN-1"),
        ),
        pytest.raises(RetirementValidationError, match="while it is assigned"),
    ):
        svc.start_disposal(ctx, asset.id)


def test_start_disposal_blocks_issued_components() -> None:
    svc = RetirementService(MagicMock())
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
        pytest.raises(RetirementValidationError, match="active components"),
    ):
        svc.start_disposal(ctx, asset.id)


def test_start_disposal_blocks_pending_transfer() -> None:
    svc = RetirementService(MagicMock())
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
        pytest.raises(RetirementValidationError, match="transfer is in progress"),
    ):
        svc.start_disposal(ctx, asset.id)


def test_start_disposal_blocks_open_maintenance() -> None:
    svc = RetirementService(MagicMock())
    ctx = _ctx()
    asset = _asset(company_id=ctx.company_id)
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
        pytest.raises(RetirementValidationError, match="maintenance"),
    ):
        svc.start_disposal(ctx, asset.id)


def test_start_disposal_not_found() -> None:
    svc = RetirementService(MagicMock())
    with (
        patch.object(svc._assets, "lock_for_update", return_value=None),
        pytest.raises(NotFoundException, match="Asset not found"),
    ):
        svc.start_disposal(_ctx(), uuid4())


def test_concurrent_start_disposal_second_fails() -> None:
    """Simulates two Start Disposal calls: first wins, second sees PENDING."""
    svc = RetirementService(MagicMock())
    ctx = _ctx()
    asset = _asset(company_id=ctx.company_id)
    after = SimpleNamespace(**{**asset.__dict__, "operational_status": Pending})

    call_count = {"n": 0}

    def lock_side_effect(*_a, **_k):
        call_count["n"] += 1
        if call_count["n"] == 1:
            return asset
        return after

    with ExitStack() as stack:
        stack.enter_context(
            patch.object(svc._assets, "lock_for_update", side_effect=lock_side_effect)
        )
        stack.enter_context(patch.object(svc._assets, "get", return_value=after))
        apply_action = stack.enter_context(
            patch.object(svc._operational, "apply_action", return_value=Pending)
        )
        _patch_clear(svc, stack)
        first = svc.start_disposal(ctx, asset.id)
        with pytest.raises(RetirementValidationError, match="already pending disposal"):
            svc.start_disposal(ctx, asset.id)

    assert first.operational_status == Pending
    assert apply_action.call_count == 1


def test_start_disposal_maps_invalid_transition_after_race() -> None:
    svc = RetirementService(MagicMock())
    ctx = _ctx()
    asset = _asset(company_id=ctx.company_id)
    raced = SimpleNamespace(**{**asset.__dict__, "operational_status": Pending})
    with ExitStack() as stack:
        stack.enter_context(patch.object(svc._assets, "lock_for_update", return_value=asset))
        stack.enter_context(patch.object(svc._assets, "get", return_value=raced))
        stack.enter_context(
            patch.object(
                svc._operational,
                "apply_action",
                side_effect=InvalidTransition("already PENDING_DISPOSAL"),
            )
        )
        _patch_clear(svc, stack)
        with pytest.raises(RetirementValidationError, match="already pending disposal"):
            svc.start_disposal(ctx, asset.id)


def test_ops_service_start_disposal_action_from_retired() -> None:
    from modules.asset.service.asset_operational_status_service import (
        AssetOperationalStatusService,
    )

    service = AssetOperationalStatusService(MagicMock())
    ctx = _ctx()
    row = SimpleNamespace(id=uuid4(), operational_status=Retired, version=1)
    with (
        patch.object(service._repo, "lock_for_update", return_value=row),
        patch.object(service._repo, "set_operational_status", return_value=row) as set_status,
        patch.object(service._audit, "log_entity_change") as audit,
    ):
        result = service.apply_action(ctx, row.id, action="start_disposal", reason="start_disposal")
    assert result == Pending
    set_status.assert_called_once()
    audit.assert_called_once()


def test_ops_service_blocks_start_disposal_from_ready() -> None:
    from modules.asset.service.asset_operational_status_service import (
        AssetOperationalStatusService,
    )

    service = AssetOperationalStatusService(MagicMock())
    row = SimpleNamespace(id=uuid4(), operational_status=Ready, version=1)
    with (
        patch.object(service._repo, "lock_for_update", return_value=row),
        patch.object(service._repo, "set_operational_status") as set_status,
        pytest.raises(InvalidTransition),
    ):
        service.apply_action(_ctx(), row.id, action="start_disposal")
    set_status.assert_not_called()
