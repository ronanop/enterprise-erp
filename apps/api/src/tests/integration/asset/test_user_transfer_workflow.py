"""SQLite-backed regression tests for Assigned → user transfer (Steps 1–3)."""

from __future__ import annotations

from contextlib import contextmanager
from datetime import datetime, timezone
from types import SimpleNamespace
from unittest.mock import MagicMock, patch
from uuid import UUID, uuid4

import pytest
from sqlalchemy import select

from modules.asset.domain.enums import AssignmentComponentIssueStatus
from modules.asset.domain.exceptions import TransferValidationError
from modules.asset.models.asset import AstAsset
from modules.asset.models.asset_assignment import AstAssetAssignment
from modules.asset.models.asset_component import AstAssetComponent
from modules.asset.models.asset_transfer import AstAssetTransfer
from modules.asset.models.assignment_component import AstAssignmentComponent
from modules.asset.schemas import UserTransferAssignRequest, UserTransferReturnToStockRequest
from modules.asset.service.transfer_service import TransferService
from modules.asset.service.user_transfer_completion_service import (
    UserTransferCompletionService,
)
from modules.foundation.domain.value_objects import TenantContext
from tests.integration.asset.conftest import insert_active_asset


class _FakeRedis:
    def __init__(self) -> None:
        self._data: dict[str, str] = {}

    def setex(self, key: str, _ttl: int, value: str) -> None:
        self._data[key] = value

    def get(self, key: str) -> str | None:
        return self._data.get(key)

    def delete(self, key: str) -> None:
        self._data.pop(key, None)


def _ctx(ids: dict) -> TenantContext:
    return TenantContext(
        tenant_id=ids["tenant_id"],
        user_id=ids["creator_id"],
        user_type="tenant_admin",
        company_id=ids["company_id"],
        branch_id=ids["branch_id"],
    )


def _redis_key(tenant_id: UUID, asset_id: UUID, verification_id: UUID) -> str:
    return (
        f"asset:user_transfer_verification:{tenant_id}:{asset_id}:{verification_id}"
    )


def _insert_active_assignment(
    db,
    ids: dict,
    asset_id,
    *,
    employee_id=None,
    department_id=None,
    employee_source: str = "MASTER_DATA",
    manual_employee_name: str | None = None,
    manual_employee_phone: str | None = None,
    manual_employee_deployed_to: str | None = None,
) -> AstAssetAssignment:
    now = datetime.now(timezone.utc)
    source = (employee_source or "MASTER_DATA").strip().upper()
    if source == "MANUAL_ENTRY":
        emp = None
        dept = department_id
        phone = manual_employee_phone if manual_employee_phone is not None else "1000000000"
        deployed = (
            manual_employee_deployed_to
            if manual_employee_deployed_to is not None
            else "manual-site"
        )
    else:
        emp = employee_id or uuid4()
        dept = department_id or uuid4()
        phone = manual_employee_phone
        deployed = manual_employee_deployed_to
    row = AstAssetAssignment(
        id=uuid4(),
        tenant_id=ids["tenant_id"],
        company_id=ids["company_id"],
        branch_id=ids["branch_id"],
        document_number=f"AASN-UT-{uuid4().hex[:8]}",
        asset_id=asset_id,
        allocation_type="employee",
        employee_id=emp,
        employee_source=source,
        manual_employee_name=manual_employee_name,
        manual_employee_phone=phone,
        manual_employee_deployed_to=deployed,
        department_id=dept,
        status="active",
        delivery_reference_status="pending",
        allocated_at=now,
        is_deleted=False,
        version=1,
        created_at=now,
        updated_at=now,
        created_by=ids["creator_id"],
        updated_by=ids["creator_id"],
    )
    db.add(row)
    db.flush()
    return row


def _insert_issued_component(db, ids: dict, *, asset_id, assignment_id) -> AstAssetComponent:
    now = datetime.now(timezone.utc)
    component = AstAssetComponent(
        id=uuid4(),
        tenant_id=ids["tenant_id"],
        company_id=ids["company_id"],
        branch_id=ids["branch_id"],
        asset_id=asset_id,
        component_code=f"CMP-{uuid4().hex[:6]}",
        component_name="Laptop Charger",
        component_type="CHARGER",
        serial_number=f"SN-{uuid4().hex[:8]}",
        status="active",
        is_deleted=False,
        version=1,
        created_at=now,
        updated_at=now,
        created_by=ids["creator_id"],
        updated_by=ids["creator_id"],
    )
    db.add(component)
    db.flush()
    link = AstAssignmentComponent(
        id=uuid4(),
        tenant_id=ids["tenant_id"],
        company_id=ids["company_id"],
        assignment_id=assignment_id,
        component_id=component.id,
        issue_status=AssignmentComponentIssueStatus.ISSUED.value,
        issued_at=now,
        is_deleted=False,
        version=1,
        created_at=now,
        updated_at=now,
        created_by=ids["creator_id"],
        updated_by=ids["creator_id"],
    )
    db.add(link)
    db.flush()
    return component


def _stage_verification(
    svc: TransferService,
    ctx: TenantContext,
    asset_id: UUID,
    *,
    assignment_id: UUID,
    fake_redis: _FakeRedis,
    asset_version: int = 1,
    verified_component_ids: list[UUID] | None = None,
) -> UUID:
    with (
        patch("modules.asset.service.transfer_service.get_redis", return_value=fake_redis),
        patch.object(svc._audit, "log_entity_change"),
        patch.object(
            svc._master,
            "get_employee",
            return_value=MagicMock(
                first_name="Test",
                last_name="User",
                employee_code="EMP-UT",
            ),
        ),
        patch.object(svc._validator._maintenances, "find_open_for_asset", return_value=None),
        patch.object(svc._validator._transfers, "find_pending_for_asset", return_value=None),
    ):
        result = svc.submit_user_transfer_verification(
            ctx,
            asset_id,
            data_backup_verified=True,
            qc_completed=True,
            qc_remarks=None,
            physical_condition="good",
            verified_component_ids=list(verified_component_ids or []),
            asset_version=asset_version,
        )
    assert result.assignment_id == assignment_id
    return result.verification_id


def _count_active_assignments(db, asset_id: UUID) -> int:
    rows = list(
        db.scalars(
            select(AstAssetAssignment).where(
                AstAssetAssignment.asset_id == asset_id,
                AstAssetAssignment.status == "active",
                AstAssetAssignment.is_deleted.is_(False),
            )
        ).all()
    )
    return len(rows)


def _count_completed_transfers(db, asset_id: UUID) -> int:
    rows = list(
        db.scalars(
            select(AstAssetTransfer).where(
                AstAssetTransfer.asset_id == asset_id,
                AstAssetTransfer.status == "completed",
                AstAssetTransfer.is_deleted.is_(False),
            )
        ).all()
    )
    return len(rows)


@contextmanager
def _assign_finalize_patches(
    completion: UserTransferCompletionService,
    *,
    fake_redis: _FakeRedis,
    company_id: UUID,
    new_employee_id: UUID,
    department_id: UUID,
    doc_prefix: str = "ATRF",
):
    """Infrastructure patches required by SQLite harness (no master/audit/site tables).

    Real assignment create → submit → activate_submitted_immediately still runs.
    """
    emp = MagicMock(department_id=department_id, first_name="New", last_name="Holder")
    dept = SimpleNamespace(company_id=company_id, department_name="IT")
    asn_docs = {"n": 0}
    trf_docs = {"n": 0}

    def _asn_doc(*_a, **_k) -> str:
        asn_docs["n"] += 1
        return f"AASN-UT-NEW-{asn_docs['n']}"

    def _trf_doc(*_a, **_k) -> str:
        trf_docs["n"] += 1
        return f"{doc_prefix}-UT-{trf_docs['n']:04d}"

    with (
        patch(
            "modules.asset.service.user_transfer_completion_service.get_redis",
            return_value=fake_redis,
        ),
        patch(
            "modules.asset.service.assignment_service.asset_workflow_governance_enabled",
            return_value=False,
        ),
        patch.object(completion._numbers, "generate", side_effect=_trf_doc),
        patch.object(completion._assignment_svc._numbers, "generate", side_effect=_asn_doc),
        patch.object(completion._audit, "log_entity_change") as audit_mock,
        patch(
            "modules.asset.service.asset_operational_status_service.log_operational_status_change",
            return_value=None,
        ),
        patch(
            "modules.foundation.service.audit_service.AuditService.log_entity_change",
            return_value=None,
        ),
        patch.object(completion._validator._master, "get_employee", return_value=emp),
        patch.object(completion._validator._org, "get_department", return_value=dept),
        patch.object(
            completion._assignment_svc._validator._master,
            "get_employee",
            return_value=emp,
        ),
        patch.object(
            completion._assignment_svc._validator._org,
            "get_department",
            return_value=dept,
        ),
        patch.object(
            completion._assignment_svc._master,
            "update_master_asset_transfer",
            return_value=MagicMock(),
        ),
        patch(
            "modules.asset.service.site_location_service.SiteLocationService.resolve_pair",
            return_value=(
                MagicMock(),
                MagicMock(),
                "Site A · Building 1",
                uuid4(),
            ),
        ),
        patch(
            "modules.asset.service.dc_challan_service.DcChallanService.auto_cancel_for_assignment",
            return_value=None,
        ),
    ):
        yield audit_mock


def _assign_body(
    *,
    verification_id: UUID,
    new_employee_id: UUID,
    department_id: UUID,
    asset_version: int,
) -> UserTransferAssignRequest:
    return UserTransferAssignRequest(
        verification_id=verification_id,
        employee_id=new_employee_id,
        department_id=department_id,
        to_location_id=uuid4(),
        to_building_id=uuid4(),
        allocated_at=datetime.now(timezone.utc).date(),
        assignment_remarks="Step4 UAT assign",
        asset_version=asset_version,
    )


@pytest.mark.integration
def test_user_transfer_context_rejects_ready_to_move(wf_db, tenant_ids) -> None:
    asset = insert_active_asset(wf_db, tenant_ids, operational_status="READY_TO_MOVE")
    svc = TransferService(wf_db)
    ctx = _ctx(tenant_ids)
    with (
        patch.object(svc._audit, "log_entity_change"),
        patch.object(svc._validator._maintenances, "find_open_for_asset", return_value=None),
        patch.object(svc._validator._transfers, "find_pending_for_asset", return_value=None),
    ):
        with pytest.raises(TransferValidationError, match="Only assigned assets"):
            svc.get_user_transfer_context(ctx, asset.id)


@pytest.mark.integration
def test_user_transfer_context_accepts_assigned_with_active_assignment(
    wf_db, tenant_ids
) -> None:
    employee_id = uuid4()
    asset = insert_active_asset(wf_db, tenant_ids, operational_status="ASSIGNED")
    asset.custodian_employee_id = employee_id
    wf_db.flush()
    assignment = _insert_active_assignment(
        wf_db, tenant_ids, asset.id, employee_id=employee_id
    )
    svc = TransferService(wf_db)
    ctx = _ctx(tenant_ids)
    with (
        patch.object(svc._audit, "log_entity_change"),
        patch.object(
            svc._master,
            "get_employee",
            return_value=MagicMock(
                first_name="Test",
                last_name="User",
                employee_code="EMP-UT",
            ),
        ),
        patch.object(
            svc._org,
            "get_department",
            return_value=SimpleNamespace(department_name="IT"),
        ),
        patch.object(svc._validator._maintenances, "find_open_for_asset", return_value=None),
        patch.object(svc._validator._transfers, "find_pending_for_asset", return_value=None),
    ):
        ctx_resp = svc.get_user_transfer_context(ctx, asset.id)
    assert ctx_resp.assignment_id == assignment.id
    assert ctx_resp.operational_status == "ASSIGNED"
    assert ctx_resp.current_employee_id == employee_id
    assert ctx_resp.current_user == "EMP-UT — Test User"


@pytest.mark.integration
def test_user_transfer_context_manual_entry_uses_manual_employee_name(
    wf_db, tenant_ids
) -> None:
    asset = insert_active_asset(wf_db, tenant_ids, operational_status="ASSIGNED")
    asset.department_id = None
    asset.custodian_employee_id = None
    wf_db.flush()
    assignment = _insert_active_assignment(
        wf_db,
        tenant_ids,
        asset.id,
        employee_source="MANUAL_ENTRY",
        manual_employee_name="shreya saxena",
        department_id=None,
    )
    svc = TransferService(wf_db)
    ctx = _ctx(tenant_ids)
    with (
        patch.object(svc._validator._maintenances, "find_open_for_asset", return_value=None),
        patch.object(svc._validator._transfers, "find_pending_for_asset", return_value=None),
    ):
        ctx_resp = svc.get_user_transfer_context(ctx, asset.id)
    assert ctx_resp.assignment_id == assignment.id
    assert ctx_resp.current_employee_id is None
    assert ctx_resp.current_user == "shreya saxena"
    assert ctx_resp.department_id is None
    assert ctx_resp.department_name is None


@pytest.mark.integration
def test_user_transfer_context_manual_entry_without_name_keeps_current_user_null(
    wf_db, tenant_ids
) -> None:
    """DB CHECK forbids blank MANUAL_ENTRY names; simulate empty name in-session."""
    asset = insert_active_asset(wf_db, tenant_ids, operational_status="ASSIGNED")
    asset.department_id = None
    asset.custodian_employee_id = None
    wf_db.flush()
    assignment = _insert_active_assignment(
        wf_db,
        tenant_ids,
        asset.id,
        employee_source="MANUAL_ENTRY",
        manual_employee_name="placeholder",
        department_id=None,
    )
    # Exercise code path for empty/whitespace name without violating DB CHECK on insert.
    assignment.manual_employee_name = "   "
    svc = TransferService(wf_db)
    ctx = _ctx(tenant_ids)
    with (
        patch.object(svc._validator._maintenances, "find_open_for_asset", return_value=None),
        patch.object(svc._validator._transfers, "find_pending_for_asset", return_value=None),
    ):
        ctx_resp = svc.get_user_transfer_context(ctx, asset.id)
    assert ctx_resp.assignment_id == assignment.id
    assert ctx_resp.current_employee_id is None
    assert ctx_resp.current_user is None


@pytest.mark.integration
def test_user_transfer_return_to_stock_closes_assignment(wf_db, tenant_ids) -> None:
    employee_id = uuid4()
    asset = insert_active_asset(wf_db, tenant_ids, operational_status="ASSIGNED")
    asset.custodian_employee_id = employee_id
    wf_db.flush()
    assignment = _insert_active_assignment(
        wf_db, tenant_ids, asset.id, employee_id=employee_id
    )
    fake_redis = _FakeRedis()
    transfer_svc = TransferService(wf_db)
    ctx = _ctx(tenant_ids)
    verification_id = _stage_verification(
        transfer_svc,
        ctx,
        asset.id,
        assignment_id=assignment.id,
        fake_redis=fake_redis,
    )

    completion = UserTransferCompletionService(wf_db)
    body = UserTransferReturnToStockRequest(
        verification_id=verification_id,
        reason="End of project",
        remarks="UAT",
        asset_version=int(asset.version or 1),
    )

    with (
        patch(
            "modules.asset.service.user_transfer_completion_service.get_redis",
            return_value=fake_redis,
        ),
        patch.object(completion._numbers, "generate", return_value=f"ATRF-{uuid4().hex[:8]}"),
        patch.object(completion._audit, "log_entity_change"),
        patch(
            "modules.asset.service.asset_operational_status_service.log_operational_status_change",
            return_value=None,
        ),
        patch(
            "modules.foundation.service.audit_service.AuditService.log_entity_change",
            return_value=None,
        ),
        patch(
            "modules.asset.service.dc_challan_service.DcChallanService.auto_cancel_for_assignment",
            return_value=None,
        ),
    ):
        result = completion.return_to_stock(ctx, asset.id, body)

    assert result.outcome == "return_to_stock"
    refreshed_asset = wf_db.scalar(select(AstAsset).where(AstAsset.id == asset.id))
    refreshed_asn = wf_db.scalar(
        select(AstAssetAssignment).where(AstAssetAssignment.id == assignment.id)
    )
    assert refreshed_asset is not None
    assert refreshed_asset.operational_status == "READY_TO_MOVE"
    assert refreshed_asset.custodian_employee_id is None
    assert refreshed_asn is not None
    assert refreshed_asn.status == "returned"
    transfer_row = wf_db.scalar(
        select(AstAssetTransfer).where(AstAssetTransfer.id == result.transfer_id)
    )
    assert transfer_row is not None
    assert transfer_row.status == "completed"
    assert fake_redis.get(_redis_key(tenant_ids["tenant_id"], asset.id, verification_id)) is None


@pytest.mark.integration
def test_user_transfer_rejects_missing_verification(wf_db, tenant_ids) -> None:
    asset = insert_active_asset(wf_db, tenant_ids, operational_status="ASSIGNED")
    assignment = _insert_active_assignment(wf_db, tenant_ids, asset.id)
    completion = UserTransferCompletionService(wf_db)
    ctx = _ctx(tenant_ids)
    body = UserTransferReturnToStockRequest(
        verification_id=uuid4(),
        reason="test",
        asset_version=int(asset.version or 1),
    )
    fake_redis = _FakeRedis()
    with patch(
        "modules.asset.service.user_transfer_completion_service.get_redis",
        return_value=fake_redis,
    ):
        with pytest.raises(TransferValidationError, match="missing, expired"):
            completion.return_to_stock(ctx, asset.id, body)
    still_active = wf_db.scalar(
        select(AstAssetAssignment).where(AstAssetAssignment.id == assignment.id)
    )
    assert still_active is not None
    assert still_active.status == "active"


@pytest.mark.integration
def test_user_transfer_rejects_stale_asset_version_on_verification(
    wf_db, tenant_ids
) -> None:
    asset = insert_active_asset(wf_db, tenant_ids, operational_status="ASSIGNED")
    _insert_active_assignment(wf_db, tenant_ids, asset.id)
    transfer_svc = TransferService(wf_db)
    ctx = _ctx(tenant_ids)
    with (
        patch("modules.asset.service.transfer_service.get_redis", return_value=_FakeRedis()),
        patch.object(transfer_svc._audit, "log_entity_change"),
        patch.object(transfer_svc._master, "get_employee", return_value=MagicMock()),
        patch.object(transfer_svc._validator._maintenances, "find_open_for_asset", return_value=None),
        patch.object(transfer_svc._validator._transfers, "find_pending_for_asset", return_value=None),
    ):
        with pytest.raises(TransferValidationError, match="updated while verification"):
            transfer_svc.submit_user_transfer_verification(
                ctx,
                asset.id,
                data_backup_verified=True,
                qc_completed=True,
                qc_remarks=None,
                physical_condition="good",
                verified_component_ids=[],
                asset_version=99,
            )


@pytest.mark.integration
def test_user_transfer_assign_happy_path_no_components(wf_db, tenant_ids) -> None:
    """ASSIGNED asset with no issued components → Assign to New User succeeds."""
    old_employee_id = uuid4()
    new_employee_id = uuid4()
    department_id = uuid4()
    asset = insert_active_asset(wf_db, tenant_ids, operational_status="ASSIGNED")
    asset.custodian_employee_id = old_employee_id
    wf_db.flush()
    old_assignment = _insert_active_assignment(
        wf_db,
        tenant_ids,
        asset.id,
        employee_id=old_employee_id,
        department_id=department_id,
    )
    fake_redis = _FakeRedis()
    transfer_svc = TransferService(wf_db)
    ctx = _ctx(tenant_ids)
    verification_id = _stage_verification(
        transfer_svc,
        ctx,
        asset.id,
        assignment_id=old_assignment.id,
        fake_redis=fake_redis,
        asset_version=int(asset.version or 1),
    )
    completion = UserTransferCompletionService(wf_db)
    body = _assign_body(
        verification_id=verification_id,
        new_employee_id=new_employee_id,
        department_id=department_id,
        asset_version=int(asset.version or 1),
    )

    with _assign_finalize_patches(
        completion,
        fake_redis=fake_redis,
        company_id=tenant_ids["company_id"],
        new_employee_id=new_employee_id,
        department_id=department_id,
    ) as audit_mock:
        result = completion.assign_to_new_user(ctx, asset.id, body)

    assert result.outcome == "assign"
    assert result.new_assignment_id is not None
    assert result.document_number.startswith("ATRF-")

    refreshed_asset = wf_db.scalar(select(AstAsset).where(AstAsset.id == asset.id))
    old_row = wf_db.scalar(
        select(AstAssetAssignment).where(AstAssetAssignment.id == old_assignment.id)
    )
    new_row = wf_db.scalar(
        select(AstAssetAssignment).where(AstAssetAssignment.id == result.new_assignment_id)
    )
    transfer_row = wf_db.scalar(
        select(AstAssetTransfer).where(AstAssetTransfer.id == result.transfer_id)
    )

    assert refreshed_asset is not None
    assert refreshed_asset.operational_status == "ASSIGNED"
    assert refreshed_asset.custodian_employee_id == new_employee_id

    assert old_row is not None
    assert old_row.status == "returned"

    assert new_row is not None
    assert new_row.status == "active"
    assert new_row.asset_id == asset.id
    assert new_row.employee_id == new_employee_id

    assert _count_active_assignments(wf_db, asset.id) == 1
    assert transfer_row is not None
    assert transfer_row.status == "completed"
    assert transfer_row.to_employee_id == new_employee_id
    assert transfer_row.from_employee_id == old_employee_id

    assert fake_redis.get(_redis_key(tenant_ids["tenant_id"], asset.id, verification_id)) is None
    audit_mock.assert_called()
    assert any(
        call.kwargs.get("operation") == "user_transfer_complete"
        for call in audit_mock.call_args_list
    )


@pytest.mark.integration
def test_user_transfer_assign_happy_path_with_components(wf_db, tenant_ids) -> None:
    """Issued components are reconciled on old assignment and reissued on the new one."""
    old_employee_id = uuid4()
    new_employee_id = uuid4()
    department_id = uuid4()
    asset = insert_active_asset(wf_db, tenant_ids, operational_status="ASSIGNED")
    asset.custodian_employee_id = old_employee_id
    wf_db.flush()
    old_assignment = _insert_active_assignment(
        wf_db,
        tenant_ids,
        asset.id,
        employee_id=old_employee_id,
        department_id=department_id,
    )
    component = _insert_issued_component(
        wf_db,
        tenant_ids,
        asset_id=asset.id,
        assignment_id=old_assignment.id,
    )
    fake_redis = _FakeRedis()
    transfer_svc = TransferService(wf_db)
    ctx = _ctx(tenant_ids)
    verification_id = _stage_verification(
        transfer_svc,
        ctx,
        asset.id,
        assignment_id=old_assignment.id,
        fake_redis=fake_redis,
        asset_version=int(asset.version or 1),
        verified_component_ids=[component.id],
    )
    completion = UserTransferCompletionService(wf_db)
    body = _assign_body(
        verification_id=verification_id,
        new_employee_id=new_employee_id,
        department_id=department_id,
        asset_version=int(asset.version or 1),
    )

    with _assign_finalize_patches(
        completion,
        fake_redis=fake_redis,
        company_id=tenant_ids["company_id"],
        new_employee_id=new_employee_id,
        department_id=department_id,
    ):
        result = completion.assign_to_new_user(ctx, asset.id, body)

    assert result.outcome == "assign"
    assert _count_active_assignments(wf_db, asset.id) == 1

    old_links = list(
        wf_db.scalars(
            select(AstAssignmentComponent).where(
                AstAssignmentComponent.assignment_id == old_assignment.id,
                AstAssignmentComponent.is_deleted.is_(False),
            )
        ).all()
    )
    new_links = list(
        wf_db.scalars(
            select(AstAssignmentComponent).where(
                AstAssignmentComponent.assignment_id == result.new_assignment_id,
                AstAssignmentComponent.is_deleted.is_(False),
            )
        ).all()
    )
    assert len(old_links) == 1
    assert old_links[0].issue_status == AssignmentComponentIssueStatus.RETURNED.value
    assert len(new_links) == 1
    assert new_links[0].component_id == component.id
    assert new_links[0].issue_status == AssignmentComponentIssueStatus.ISSUED.value

    parent = wf_db.scalar(select(AstAssetComponent).where(AstAssetComponent.id == component.id))
    assert parent is not None
    assert parent.asset_id == asset.id
    assert parent.status == "active"


@pytest.mark.integration
def test_user_transfer_assign_duplicate_finalize_rejected(wf_db, tenant_ids) -> None:
    """Second finalize with the same consumed verification must not mutate state."""
    old_employee_id = uuid4()
    new_employee_id = uuid4()
    department_id = uuid4()
    asset = insert_active_asset(wf_db, tenant_ids, operational_status="ASSIGNED")
    asset.custodian_employee_id = old_employee_id
    wf_db.flush()
    old_assignment = _insert_active_assignment(
        wf_db,
        tenant_ids,
        asset.id,
        employee_id=old_employee_id,
        department_id=department_id,
    )
    fake_redis = _FakeRedis()
    transfer_svc = TransferService(wf_db)
    ctx = _ctx(tenant_ids)
    verification_id = _stage_verification(
        transfer_svc,
        ctx,
        asset.id,
        assignment_id=old_assignment.id,
        fake_redis=fake_redis,
        asset_version=int(asset.version or 1),
    )
    completion = UserTransferCompletionService(wf_db)
    # Capture version before first finalize; second body reuses same payload.
    body = _assign_body(
        verification_id=verification_id,
        new_employee_id=new_employee_id,
        department_id=department_id,
        asset_version=int(asset.version or 1),
    )

    with _assign_finalize_patches(
        completion,
        fake_redis=fake_redis,
        company_id=tenant_ids["company_id"],
        new_employee_id=new_employee_id,
        department_id=department_id,
    ):
        first = completion.assign_to_new_user(ctx, asset.id, body)

    assert first.outcome == "assign"
    assert fake_redis.get(_redis_key(tenant_ids["tenant_id"], asset.id, verification_id)) is None
    transfers_after_first = _count_completed_transfers(wf_db, asset.id)
    active_after_first = _count_active_assignments(wf_db, asset.id)
    assert active_after_first == 1

    with _assign_finalize_patches(
        completion,
        fake_redis=fake_redis,
        company_id=tenant_ids["company_id"],
        new_employee_id=new_employee_id,
        department_id=department_id,
    ):
        with pytest.raises(TransferValidationError, match="missing, expired"):
            completion.assign_to_new_user(ctx, asset.id, body)

    refreshed_asset = wf_db.scalar(select(AstAsset).where(AstAsset.id == asset.id))
    assert refreshed_asset is not None
    assert refreshed_asset.operational_status == "ASSIGNED"
    assert refreshed_asset.custodian_employee_id == new_employee_id
    assert _count_active_assignments(wf_db, asset.id) == 1
    assert _count_completed_transfers(wf_db, asset.id) == transfers_after_first
    new_active = wf_db.scalar(
        select(AstAssetAssignment).where(AstAssetAssignment.id == first.new_assignment_id)
    )
    assert new_active is not None
    assert new_active.status == "active"
    assert new_active.employee_id == new_employee_id


@pytest.mark.integration
def test_user_transfer_assign_redis_verification_consumed_after_success(
    wf_db, tenant_ids
) -> None:
    """Successful finalize deletes Redis staging; reuse is rejected."""
    old_employee_id = uuid4()
    new_employee_id = uuid4()
    department_id = uuid4()
    asset = insert_active_asset(wf_db, tenant_ids, operational_status="ASSIGNED")
    asset.custodian_employee_id = old_employee_id
    wf_db.flush()
    old_assignment = _insert_active_assignment(
        wf_db,
        tenant_ids,
        asset.id,
        employee_id=old_employee_id,
        department_id=department_id,
    )
    fake_redis = _FakeRedis()
    transfer_svc = TransferService(wf_db)
    ctx = _ctx(tenant_ids)
    verification_id = _stage_verification(
        transfer_svc,
        ctx,
        asset.id,
        assignment_id=old_assignment.id,
        fake_redis=fake_redis,
        asset_version=int(asset.version or 1),
    )
    key = _redis_key(tenant_ids["tenant_id"], asset.id, verification_id)
    assert fake_redis.get(key) is not None

    completion = UserTransferCompletionService(wf_db)
    body = _assign_body(
        verification_id=verification_id,
        new_employee_id=new_employee_id,
        department_id=department_id,
        asset_version=int(asset.version or 1),
    )
    with _assign_finalize_patches(
        completion,
        fake_redis=fake_redis,
        company_id=tenant_ids["company_id"],
        new_employee_id=new_employee_id,
        department_id=department_id,
    ):
        completion.assign_to_new_user(ctx, asset.id, body)

    assert fake_redis.get(key) is None
    with patch(
        "modules.asset.service.user_transfer_completion_service.get_redis",
        return_value=fake_redis,
    ):
        with pytest.raises(TransferValidationError, match="missing, expired"):
            completion.assign_to_new_user(ctx, asset.id, body)


@pytest.mark.integration
def test_user_transfer_assign_rollback_on_new_assignment_failure(wf_db, tenant_ids) -> None:
    """If new assignment create fails inside a savepoint, prior state is restored.

    Limitation: SQLite savepoint mirrors request UoW rollback; production uses
    the FastAPI get_db commit/rollback boundary. Redis is outside the DB
    transaction — verification must remain staged when finalize fails before
    successful completion.
    """
    employee_id = uuid4()
    new_employee_id = uuid4()
    department_id = uuid4()
    asset = insert_active_asset(wf_db, tenant_ids, operational_status="ASSIGNED")
    asset.custodian_employee_id = employee_id
    wf_db.flush()
    assignment = _insert_active_assignment(
        wf_db, tenant_ids, asset.id, employee_id=employee_id, department_id=department_id
    )
    fake_redis = _FakeRedis()
    transfer_svc = TransferService(wf_db)
    ctx = _ctx(tenant_ids)
    verification_id = _stage_verification(
        transfer_svc,
        ctx,
        asset.id,
        assignment_id=assignment.id,
        fake_redis=fake_redis,
        asset_version=int(asset.version or 1),
    )
    completion = UserTransferCompletionService(wf_db)
    body = _assign_body(
        verification_id=verification_id,
        new_employee_id=new_employee_id,
        department_id=department_id,
        asset_version=int(asset.version or 1),
    )
    redis_key = _redis_key(tenant_ids["tenant_id"], asset.id, verification_id)

    with (
        patch(
            "modules.asset.service.user_transfer_completion_service.get_redis",
            return_value=fake_redis,
        ),
        patch(
            "modules.asset.service.assignment_service.asset_workflow_governance_enabled",
            return_value=False,
        ),
        patch.object(completion._numbers, "generate", return_value=f"ATRF-{uuid4().hex[:8]}"),
        patch.object(completion._audit, "log_entity_change"),
        patch(
            "modules.asset.service.asset_operational_status_service.log_operational_status_change",
            return_value=None,
        ),
        patch(
            "modules.foundation.service.audit_service.AuditService.log_entity_change",
            return_value=None,
        ),
        patch.object(
            completion._validator._master,
            "get_employee",
            return_value=MagicMock(department_id=department_id),
        ),
        patch.object(
            completion._validator._org,
            "get_department",
            return_value=SimpleNamespace(company_id=tenant_ids["company_id"]),
        ),
        patch(
            "modules.asset.service.site_location_service.SiteLocationService.resolve_pair",
            return_value=(
                MagicMock(),
                MagicMock(),
                "Site A · Building 1",
                uuid4(),
            ),
        ),
        patch(
            "modules.asset.service.dc_challan_service.DcChallanService.auto_cancel_for_assignment",
            return_value=None,
        ),
        patch.object(
            completion._assignment_svc,
            "create",
            side_effect=RuntimeError("simulated create failure"),
        ),
    ):
        nested = wf_db.begin_nested()
        with pytest.raises(RuntimeError, match="simulated create failure"):
            completion.assign_to_new_user(ctx, asset.id, body)
        nested.rollback()

    still_active = wf_db.scalar(
        select(AstAssetAssignment).where(AstAssetAssignment.id == assignment.id)
    )
    refreshed_asset = wf_db.scalar(select(AstAsset).where(AstAsset.id == asset.id))
    assert still_active is not None
    assert still_active.status == "active"
    assert refreshed_asset is not None
    assert refreshed_asset.operational_status == "ASSIGNED"
    assert refreshed_asset.custodian_employee_id == employee_id
    assert _count_active_assignments(wf_db, asset.id) == 1
    assert _count_completed_transfers(wf_db, asset.id) == 0
    # Verification is consumed only after successful completion; failure must leave it.
    assert fake_redis.get(redis_key) is not None
