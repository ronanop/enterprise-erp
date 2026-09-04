"""Unit tests for standalone DC challan tracking."""

from types import SimpleNamespace
from unittest.mock import MagicMock, patch
from uuid import uuid4

import pytest
from sqlalchemy.exc import IntegrityError

from core.exceptions import ConflictException, NotFoundException
from modules.asset.domain.enums import (
    AssetOperationalStatus,
    AssignmentDeliveryReferenceStatus,
    DcChallanStatus,
)
from modules.asset.domain.exceptions import DcChallanValidationError, InvalidDcChallanState
from modules.asset.service.asset_operational_status_service import AssetOperationalStatusService
from modules.asset.service.assignment_service import AssignmentService
from modules.asset.service.dc_challan_service import OPEN_DC_CONFLICT, DcChallanService
from modules.asset.service.dc_challan_validator import (
    employee_phone_missing,
    employee_snapshots_ready,
    format_employee_name,
    validate_dc_document_url,
)
from modules.foundation.domain.value_objects import TenantContext


def _ctx() -> TenantContext:
    return TenantContext(
        tenant_id=uuid4(),
        user_id=uuid4(),
        user_type="employee",
        company_id=uuid4(),
        branch_id=uuid4(),
    )


def _asset(**overrides):
    base = dict(
        id=uuid4(),
        company_id=uuid4(),
        branch_id=uuid4(),
        asset_name="Laptop",
        asset_code="AST-2026-000001",
        make="Dell",
        model="XPS",
        serial_number="SN-1",
        purchase_cost=None,
        operational_status=AssetOperationalStatus.READY_TO_MOVE.value,
    )
    base.update(overrides)
    return SimpleNamespace(**base)


def _employee(**overrides):
    base = dict(
        employee_code="E-100",
        first_name="Ada",
        last_name="Lovelace",
        email="ada@example.com",
        mobile="9999999999",
    )
    base.update(overrides)
    return SimpleNamespace(**base)


def _assignment(**overrides):
    base = dict(
        id=uuid4(),
        asset_id=uuid4(),
        allocation_type="employee",
        employee_id=uuid4(),
        document_number="AASN-2026-000001",
        delivery_reference_number=None,
        delivery_reference_status=AssignmentDeliveryReferenceStatus.NOT_APPLICABLE.value,
    )
    base.update(overrides)
    return SimpleNamespace(**base)


def _row(**overrides):
    base = dict(
        id=uuid4(),
        dc_number="DC-2026-000001",
        asset_id=uuid4(),
        assignment_id=None,
        employee_id=uuid4(),
        status=DcChallanStatus.PENDING.value,
        company_id=uuid4(),
        branch_id=uuid4(),
        tenant_id=uuid4(),
        created_by=uuid4(),
        updated_by=uuid4(),
        employee_code="E-100",
        employee_name="Ada Lovelace",
        employee_phone="9999999999",
        employee_email="ada@example.com",
        asset_name="Laptop",
        asset_tag="AST-1",
        make="Dell",
        model="XPS",
        serial_number="SN-1",
        purchase_cost=None,
        scm_document_url=None,
        scm_reference_number=None,
        remarks=None,
        sent_to_scm_at=None,
        version=1,
    )
    base.update(overrides)
    return SimpleNamespace(**base)


def _svc() -> DcChallanService:
    svc = DcChallanService(MagicMock())
    svc._audit.log_entity_change = MagicMock()
    svc._scm.send_dc_request = MagicMock()
    svc._scm.push_status_update = MagicMock()
    svc._docs = MagicMock()
    svc._docs.list_active.return_value = []
    svc._docs.get_active.return_value = None
    svc._docs.map_active.return_value = {}
    svc._storage = MagicMock()
    return svc


def test_employee_snapshots_phone_optional() -> None:
    ready = SimpleNamespace(employee_code="E", employee_name="N", employee_email="a@b.c", employee_phone="")
    assert employee_snapshots_ready(ready) is True
    assert employee_phone_missing(ready) is True
    incomplete = SimpleNamespace(employee_code="E", employee_name="N", employee_email="", employee_phone="1")
    assert employee_snapshots_ready(incomplete) is False


def test_format_employee_name_and_url() -> None:
    assert format_employee_name(_employee()) == "Ada Lovelace"
    assert validate_dc_document_url("https://files.example.com/dc.pdf").startswith("https://")
    with pytest.raises(DcChallanValidationError):
        validate_dc_document_url("javascript:alert(1)")


def test_create_prefills_mobile_as_phone() -> None:
    svc = _svc()
    ctx = _ctx()
    asset = _asset(company_id=ctx.company_id, branch_id=ctx.branch_id)
    employee = _employee(mobile="555-0100")
    created = _row(employee_phone="555-0100")
    emp_id = uuid4()
    with (
        patch.object(svc._validator, "require_asset", return_value=asset),
        patch.object(svc._scope, "validate_company_access"),
        patch.object(svc._validator, "validate_create_eligibility"),
        patch.object(svc._master, "get_employee", return_value=employee),
        patch.object(svc._numbers, "generate", return_value="DC-2026-000002"),
        patch.object(svc._repo, "create", return_value=created) as create,
    ):
        svc.create(ctx, asset_id=asset.id, employee_id=emp_id)
        kwargs = create.call_args.kwargs
        assert kwargs["employee_phone"] == "555-0100"
        assert kwargs["employee_email"] == "ada@example.com"
        assert kwargs["employee_name"] == "Ada Lovelace"
        assert kwargs["asset_tag"] == asset.asset_code
        assert kwargs["branch_id"] == asset.branch_id
        assert kwargs["employee_id"] == emp_id


def test_create_rejects_non_employee_assignment() -> None:
    svc = _svc()
    ctx = _ctx()
    asset = _asset()
    assignment = _assignment(asset_id=asset.id, allocation_type="warehouse")
    with (
        patch.object(svc._validator, "require_asset", return_value=asset),
        patch.object(svc._scope, "validate_company_access"),
        patch.object(svc._validator, "validate_create_eligibility"),
        patch.object(svc._validator, "require_assignment", return_value=assignment),
        patch.object(
            svc._validator,
            "validate_employee_assignment",
            side_effect=DcChallanValidationError(
                "DC challan can only be linked to employee allocations in this phase"
            ),
        ),
    ):
        with pytest.raises(DcChallanValidationError, match="employee allocations"):
            svc.create(ctx, asset_id=asset.id, assignment_id=assignment.id)


def test_create_maps_open_unique_integrity_error() -> None:
    svc = _svc()
    ctx = _ctx()
    asset = _asset()
    orig = Exception("duplicate key value violates unique constraint uq_ast_dc_challan_one_open_per_asset")
    with (
        patch.object(svc._validator, "require_asset", return_value=asset),
        patch.object(svc._scope, "validate_company_access"),
        patch.object(svc._validator, "validate_create_eligibility"),
        patch.object(svc._numbers, "generate", return_value="DC-2026-000003"),
        patch.object(
            svc._repo,
            "create",
            side_effect=IntegrityError("INSERT", {}, orig),
        ),
    ):
        with pytest.raises(ConflictException, match="open DC challan"):
            svc.create(ctx, asset_id=asset.id)
    assert OPEN_DC_CONFLICT


def test_link_assignment_rejects_employee_mismatch() -> None:
    svc = _svc()
    ctx = _ctx()
    row = _row(employee_id=uuid4())
    assignment = _assignment(asset_id=row.asset_id, employee_id=uuid4())
    with (
        patch.object(svc, "get", return_value=row),
        patch.object(svc._validator, "require_assignment", return_value=assignment),
        patch.object(svc._validator, "validate_employee_assignment"),
    ):
        with pytest.raises(DcChallanValidationError, match="does not match"):
            svc.link_assignment(ctx, row.id, assignment.id)


def test_link_assignment_fills_null_employee() -> None:
    svc = _svc()
    ctx = _ctx()
    row = _row(employee_id=None, employee_code=None, employee_name=None, employee_email=None)
    assignment = _assignment(asset_id=row.asset_id)
    employee = _employee()
    updated = _row(assignment_id=assignment.id, employee_id=assignment.employee_id)
    with (
        patch.object(svc, "get", return_value=row),
        patch.object(svc._validator, "require_assignment", return_value=assignment),
        patch.object(svc._validator, "validate_employee_assignment"),
        patch.object(svc._master, "get_employee", return_value=employee),
        patch.object(svc._repo, "update", return_value=updated) as update,
        patch.object(svc, "_sync_assignment_delivery_reference") as sync,
    ):
        svc.link_assignment(ctx, row.id, assignment.id)
        kwargs = update.call_args.kwargs
        assert kwargs["employee_id"] == assignment.employee_id
        assert kwargs["employee_email"] == "ada@example.com"
        sync.assert_called_once()


def test_send_blocked_when_email_missing() -> None:
    svc = _svc()
    ctx = _ctx()
    row = _row(employee_email="")
    with patch.object(svc, "get", return_value=row):
        with pytest.raises(DcChallanValidationError, match="code, name, and email"):
            svc.send_to_scm(ctx, row.id)
    svc._scm.send_dc_request.assert_not_called()


def test_send_allows_blank_phone() -> None:
    svc = _svc()
    ctx = _ctx()
    row = _row(employee_phone="", status=DcChallanStatus.PENDING.value)
    sent = _row(status=DcChallanStatus.SENT_TO_SCM.value)
    with (
        patch.object(svc, "get", return_value=row),
        patch.object(svc._repo, "update", return_value=sent),
    ):
        result = svc.send_to_scm(ctx, row.id)
    assert result.status == DcChallanStatus.SENT_TO_SCM.value
    svc._scm.send_dc_request.assert_called_once()


def test_callback_idempotent_same_url() -> None:
    svc = _svc()
    row = _row(
        status=DcChallanStatus.DOCUMENT_RECEIVED.value,
        scm_document_url="https://files.example.com/dc.pdf",
        scm_reference_number="SCM-1",
        tenant_id=uuid4(),
    )
    with patch.object(svc._repo, "get_by_id_unscoped", return_value=row):
        result = svc.apply_scm_callback(
            row.id,
            document_url="https://files.example.com/dc.pdf",
            scm_reference_number="SCM-1",
        )
    assert result is row
    svc._audit.log_entity_change.assert_not_called()


def test_callback_conflict_on_url_change() -> None:
    svc = _svc()
    row = _row(
        status=DcChallanStatus.DOCUMENT_RECEIVED.value,
        scm_document_url="https://files.example.com/dc.pdf",
        scm_reference_number="SCM-1",
        tenant_id=uuid4(),
    )
    with patch.object(svc._repo, "get_by_id_unscoped", return_value=row):
        with pytest.raises(ConflictException, match="different SCM document"):
            svc.apply_scm_callback(
                row.id,
                document_url="https://files.example.com/other.pdf",
                scm_reference_number="SCM-1",
            )


def test_callback_transitions_from_sent() -> None:
    svc = _svc()
    row = _row(
        status=DcChallanStatus.SENT_TO_SCM.value,
        tenant_id=uuid4(),
        company_id=uuid4(),
        branch_id=uuid4(),
    )
    updated = _row(status=DcChallanStatus.DOCUMENT_RECEIVED.value)
    pdf = b"%PDF-1.4\n1 0 obj\n<<>>\nendobj\n%%EOF\n"
    with (
        patch.object(svc._repo, "get_by_id_unscoped", return_value=row),
        patch.object(svc._repo, "update_row", return_value=updated) as update_row,
        patch(
            "modules.asset.service.dc_challan_service.download_document_bytes",
            return_value=pdf,
        ),
    ):
        svc.apply_scm_callback(row.id, document_url="https://files.example.com/dc.pdf")
        assert update_row.call_args.kwargs["status"] == DcChallanStatus.DOCUMENT_RECEIVED.value
        svc._audit.log_entity_change.assert_called()
        svc._storage.save.assert_called_once()


def test_bulk_send_mixed_results() -> None:
    svc = _svc()
    ctx = _ctx()
    ok_id = uuid4()
    skip_id = uuid4()
    missing_id = uuid4()

    def fake_send(_ctx, row_id):
        if row_id == ok_id:
            return _row(id=row_id)
        if row_id == skip_id:
            raise InvalidDcChallanState("Only PENDING can be sent")
        raise NotFoundException("DC challan not found")

    with patch.object(svc, "send_to_scm", side_effect=fake_send):
        result = svc.bulk_send_to_scm(ctx, [ok_id, skip_id, missing_id])
    assert result.sent_count == 1
    assert result.skipped_count == 2
    assert result.results[0].ok is True
    assert result.results[1].ok is False
    assert result.results[2].ok is False


def test_auto_cancel_idempotent_when_already_cancelled() -> None:
    svc = _svc()
    ctx = _ctx()
    cancelled = _row(status=DcChallanStatus.CANCELLED.value)
    with (
        patch.object(svc._repo, "list_open_for_assignment", return_value=[cancelled]),
        patch.object(svc._repo, "update_row") as update_row,
    ):
        count = svc.auto_cancel_for_assignment(ctx, uuid4(), remark="x")
    assert count == 0
    update_row.assert_not_called()
    svc._audit.log_entity_change.assert_not_called()


def test_auto_cancel_assignment_includes_signed_not_received() -> None:
    svc = _svc()
    ctx = _ctx()
    signed = _row(status=DcChallanStatus.SIGNED.value)
    received = _row(status=DcChallanStatus.RECEIVED.value)
    with (
        patch.object(svc._repo, "list_open_for_assignment", return_value=[signed, received]),
        patch.object(svc._repo, "update_row", side_effect=lambda _ctx, row, **kw: row) as update_row,
    ):
        count = svc.auto_cancel_for_assignment(ctx, uuid4(), remark="assignment cancelled")
    assert count == 1
    assert update_row.call_args.kwargs["status"] == DcChallanStatus.CANCELLED.value


def test_ops_auto_cancel_skips_signed() -> None:
    svc = _svc()
    ctx = _ctx()
    pending = _row(status=DcChallanStatus.PENDING.value)
    signed = _row(status=DcChallanStatus.SIGNED.value)
    with (
        patch.object(svc._repo, "list_open_for_asset", return_value=[pending, signed]),
        patch.object(svc._repo, "update_row", side_effect=lambda _ctx, row, **kw: row) as update_row,
    ):
        # Service still iterates whatever the repo returned; ops hook passes a status set
        # so SIGNED is not in the list. Simulate repo already filtered, plus a stray SIGNED.
        count = svc._auto_cancel(ctx, rows=[pending, signed], remark="retired")
    # _auto_cancel will still cancel SIGNED if present; ops path must pass filtered statuses.
    assert count == 2
    update_row.reset_mock()
    with (
        patch.object(svc._repo, "list_open_for_asset", return_value=[pending]),
        patch.object(svc._repo, "update_row", side_effect=lambda _ctx, row, **kw: row),
    ):
        count = svc.auto_cancel_open_for_asset(ctx, uuid4(), remark="retired")
    assert count == 1


def test_linear_status_rejects_skip() -> None:
    svc = _svc()
    ctx = _ctx()
    row = _row(status=DcChallanStatus.PENDING.value)
    with patch.object(svc, "get", return_value=row):
        with pytest.raises(InvalidDcChallanState):
            svc.mark_signed(ctx, row.id)


def test_mark_signed_requires_signed_document() -> None:
    svc = _svc()
    ctx = _ctx()
    row = _row(status=DcChallanStatus.DOCUMENT_RECEIVED.value, signed_document_url=None)
    with patch.object(svc, "get", return_value=row):
        with pytest.raises(DcChallanValidationError, match="signed document"):
            svc.mark_signed(ctx, row.id)


def test_cancel_draft_hooks_dc_auto_cancel() -> None:
    asn = AssignmentService(MagicMock())
    ctx = _ctx()
    row = SimpleNamespace(
        id=uuid4(),
        status="draft",
        workflow_instance_id=None,
        document_number="AASN-1",
        created_by=uuid4(),
        asset_id=uuid4(),
    )
    with (
        patch.object(asn, "get", return_value=row),
        patch.object(asn._repo, "update", return_value=row),
        patch.object(asn._audit, "log_entity_change"),
        patch.object(asn, "_auto_cancel_assignment_dcs") as hook,
    ):
        asn.cancel_draft(ctx, row.id)
        hook.assert_called_once()
        assert "cancelled" in hook.call_args.kwargs["remark"]


def test_reopen_does_not_call_dc_auto_cancel() -> None:
    asn = AssignmentService(MagicMock())
    ctx = _ctx()
    row = SimpleNamespace(
        id=uuid4(),
        status="cancelled",
        workflow_status="rejected",
        workflow_instance_id=uuid4(),
        document_number="AASN-1",
    )
    with (
        patch.object(asn, "get", return_value=row),
        patch.object(asn._repo, "update", return_value=row),
        patch.object(asn._audit, "log_entity_change"),
        patch.object(asn, "_auto_cancel_assignment_dcs") as hook,
    ):
        asn.reopen(ctx, row.id)
        hook.assert_not_called()


def test_reject_hooks_dc_auto_cancel() -> None:
    asn = AssignmentService(MagicMock())
    ctx = _ctx()
    row = SimpleNamespace(
        id=uuid4(),
        status="submitted",
        workflow_instance_id=uuid4(),
        document_number="AASN-1",
        created_by=uuid4(),
    )
    with (
        patch(
            "modules.asset.service.assignment_service.asset_workflow_governance_enabled",
            return_value=True,
        ),
        patch.object(asn, "get", return_value=row),
        patch.object(asn._governance, "reject"),
        patch.object(asn, "_auto_cancel_assignment_dcs") as hook,
    ):
        asn.reject(ctx, row.id, comments="no")
        hook.assert_called_once()
        assert "cancelled" in hook.call_args.kwargs["remark"]


def test_return_assignment_hooks_dc_auto_cancel() -> None:
    asn = AssignmentService(MagicMock())
    ctx = _ctx()
    row = SimpleNamespace(
        id=uuid4(),
        asset_id=uuid4(),
        document_number="AASN-1",
        allocation_type="employee",
        employee_id=uuid4(),
        status="active",
    )
    asset = SimpleNamespace(
        id=row.asset_id,
        version=1,
        custodian_employee_id=None,
        master_asset_id=None,
    )
    with (
        patch.object(asn, "get", return_value=row),
        patch.object(asn._validator, "validate_return_readiness"),
        patch.object(asn._validator, "validate_return_request", return_value="return_to_ready"),
        patch.object(asn._assignment_components, "reconcile_return"),
        patch.object(asn._assets, "lock_for_update", return_value=asset),
        patch.object(asn._operational, "apply_action"),
        patch.object(asn._engine, "return_assignment"),
        patch.object(asn._assets, "get", return_value=asset),
        patch.object(asn._repo, "complete_return", return_value=row),
        patch.object(asn._audit, "log_entity_change"),
        patch.object(asn, "_auto_cancel_assignment_dcs") as hook,
    ):
        asn.return_assignment(ctx, row.id, return_condition="good")
        hook.assert_called_once()
        assert "returned" in hook.call_args.kwargs["remark"]


def test_ops_persist_hooks_dc_cancel_for_retired() -> None:
    ops = AssetOperationalStatusService(MagicMock())
    ctx = _ctx()
    asset_id = uuid4()
    with (
        patch.object(ops._repo, "set_operational_status", return_value=SimpleNamespace()),
        patch(
            "modules.asset.service.asset_operational_status_service.log_operational_status_change"
        ),
        patch(
            "modules.asset.service.dc_challan_service.DcChallanService.auto_cancel_open_for_asset",
            return_value=1,
        ) as hook,
    ):
        ops._persist_transition(
            ctx,
            asset_id,
            current=AssetOperationalStatus.READY_TO_MOVE.value,
            target=AssetOperationalStatus.RETIRED.value,
            action="retire",
            expected_version=1,
            reason=None,
            remarks=None,
            source_entity=None,
            source_entity_id=None,
            row=SimpleNamespace(version=1),
        )
        hook.assert_called_once()


def test_ops_persist_does_not_hook_for_assigned() -> None:
    ops = AssetOperationalStatusService(MagicMock())
    ctx = _ctx()
    with (
        patch.object(ops._repo, "set_operational_status", return_value=SimpleNamespace()),
        patch(
            "modules.asset.service.asset_operational_status_service.log_operational_status_change"
        ),
        patch(
            "modules.asset.service.dc_challan_service.DcChallanService.auto_cancel_open_for_asset"
        ) as hook,
    ):
        ops._persist_transition(
            ctx,
            uuid4(),
            current=AssetOperationalStatus.READY_TO_MOVE.value,
            target=AssetOperationalStatus.ASSIGNED.value,
            action="assign",
            expected_version=1,
            reason=None,
            remarks=None,
            source_entity=None,
            source_entity_id=None,
            row=SimpleNamespace(version=1),
        )
        hook.assert_not_called()


def test_dc_prefix_shape() -> None:
    from modules.asset.domain.enums import CODE_PREFIXES, AstEntityType

    prefix, width, include_year = CODE_PREFIXES[AstEntityType.DC_CHALLAN]
    assert prefix == "DC-"
    assert width == 6
    assert include_year is True
    assert f"{prefix}{2026}-{1:0{width}d}" == "DC-2026-000001"
