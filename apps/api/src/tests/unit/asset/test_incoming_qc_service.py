"""Unit tests for Incoming Asset QC accept/reject (Sub-phase 2)."""

from decimal import Decimal
from types import SimpleNamespace
from unittest.mock import MagicMock, patch
from uuid import uuid4

import pytest

from core.exceptions import ConflictException, NotFoundException
from modules.asset.domain.enums import IncomingAssetQcStatus, IncomingAssetUnitQcStatus
from modules.asset.repository.incoming_asset_repository import compute_line_qc_status
from modules.asset.service.incoming_qc_service import IncomingAssetQcService
from modules.foundation.domain.value_objects import TenantContext


def _ctx() -> TenantContext:
    return TenantContext(
        tenant_id=uuid4(),
        user_id=uuid4(),
        user_type="employee",
        company_id=uuid4(),
        branch_id=uuid4(),
    )


def test_compute_line_qc_status() -> None:
    assert (
        compute_line_qc_status(Decimal("10"), Decimal("0"), Decimal("0"), started=False)
        == IncomingAssetQcStatus.PENDING.value
    )
    assert (
        compute_line_qc_status(Decimal("10"), Decimal("0"), Decimal("0"), started=True)
        == IncomingAssetQcStatus.IN_PROGRESS.value
    )
    assert (
        compute_line_qc_status(Decimal("10"), Decimal("4"), Decimal("0"), started=True)
        == IncomingAssetQcStatus.IN_PROGRESS.value
    )
    assert (
        compute_line_qc_status(Decimal("10"), Decimal("10"), Decimal("0"), started=True)
        == IncomingAssetQcStatus.ACCEPTED.value
    )
    assert (
        compute_line_qc_status(Decimal("10"), Decimal("0"), Decimal("10"), started=True)
        == IncomingAssetQcStatus.REJECTED.value
    )
    assert (
        compute_line_qc_status(Decimal("10"), Decimal("6"), Decimal("4"), started=True)
        == IncomingAssetQcStatus.ACCEPTED.value
    )


def test_accept_partial() -> None:
    svc = IncomingAssetQcService(MagicMock())
    ctx = _ctx()
    row_id = uuid4()
    line = SimpleNamespace(
        id=row_id,
        branch_id=ctx.branch_id,
        arrived_quantity=Decimal("10"),
        accepted_quantity=Decimal("0"),
        rejected_quantity=Decimal("0"),
        qc_status=IncomingAssetQcStatus.PENDING.value,
    )
    after = SimpleNamespace(
        id=row_id,
        branch_id=ctx.branch_id,
        arrived_quantity=Decimal("10"),
        accepted_quantity=Decimal("4"),
        rejected_quantity=Decimal("0"),
        qc_status=IncomingAssetQcStatus.IN_PROGRESS.value,
    )
    with (
        patch.object(svc._repo, "get_for_update", return_value=line),
        patch.object(svc._scope, "validate_branch_access"),
        patch.object(svc._repo, "apply_qc_disposition", return_value=after) as apply,
        patch.object(svc._audit, "log_entity_change") as audit,
        patch.object(svc._repo, "get", return_value=after),
    ):
        result = svc.accept(ctx, row_id, quantity=4)
    assert result.accepted_quantity == Decimal("4")
    apply.assert_called_once()
    assert apply.call_args.kwargs["accept"] is True
    assert audit.call_args.kwargs["new_value"]["ast_asset_created"] is False


def test_reject_requires_reason() -> None:
    svc = IncomingAssetQcService(MagicMock())
    ctx = _ctx()
    with pytest.raises(ConflictException, match="rejection_reason"):
        svc.reject(ctx, uuid4(), quantity=1, rejection_reason=None)


def test_reject_full() -> None:
    svc = IncomingAssetQcService(MagicMock())
    ctx = _ctx()
    row_id = uuid4()
    line = SimpleNamespace(
        id=row_id,
        branch_id=ctx.branch_id,
        arrived_quantity=Decimal("5"),
        accepted_quantity=Decimal("0"),
        rejected_quantity=Decimal("0"),
    )
    after = SimpleNamespace(
        id=row_id,
        arrived_quantity=Decimal("5"),
        accepted_quantity=Decimal("0"),
        rejected_quantity=Decimal("5"),
        qc_status=IncomingAssetQcStatus.REJECTED.value,
    )
    with (
        patch.object(svc._repo, "get_for_update", return_value=line),
        patch.object(svc._scope, "validate_branch_access"),
        patch.object(svc._repo, "apply_qc_disposition", return_value=after),
        patch.object(svc._audit, "log_entity_change"),
        patch.object(svc._repo, "get", return_value=after),
    ):
        result = svc.reject(ctx, row_id, mark_all_pending=True, rejection_reason="Damaged")
    assert result.qc_status == IncomingAssetQcStatus.REJECTED.value


def test_over_dispose_rejected() -> None:
    svc = IncomingAssetQcService(MagicMock())
    ctx = _ctx()
    row_id = uuid4()
    line = SimpleNamespace(
        id=row_id,
        branch_id=ctx.branch_id,
        arrived_quantity=Decimal("10"),
        accepted_quantity=Decimal("8"),
        rejected_quantity=Decimal("0"),
    )
    with (
        patch.object(svc._repo, "get_for_update", return_value=line),
        patch.object(svc._scope, "validate_branch_access"),
        patch.object(
            svc._repo,
            "apply_qc_disposition",
            side_effect=ValueError("quantity exceeds pending QC quantity"),
        ),
    ):
        with pytest.raises(ConflictException, match="exceeds pending QC"):
            svc.accept(ctx, row_id, quantity=5)


def test_already_complete_rejected() -> None:
    svc = IncomingAssetQcService(MagicMock())
    ctx = _ctx()
    line = SimpleNamespace(
        id=uuid4(),
        branch_id=ctx.branch_id,
        arrived_quantity=Decimal("3"),
        accepted_quantity=Decimal("2"),
        rejected_quantity=Decimal("1"),
    )
    with (
        patch.object(svc._repo, "get_for_update", return_value=line),
        patch.object(svc._scope, "validate_branch_access"),
    ):
        with pytest.raises(ConflictException, match="No pending QC"):
            svc.accept(ctx, line.id, quantity=1)


def test_start_not_found() -> None:
    svc = IncomingAssetQcService(MagicMock())
    ctx = _ctx()
    with patch.object(svc._repo, "get_for_update", return_value=None):
        with pytest.raises(NotFoundException):
            svc.start(ctx, uuid4())


def test_unit_qc_status_constants() -> None:
    assert IncomingAssetUnitQcStatus.PENDING_QC.value == "PENDING_QC"
    assert IncomingAssetUnitQcStatus.ACCEPTED.value == "ACCEPTED"
    assert IncomingAssetUnitQcStatus.REJECTED.value == "REJECTED"
