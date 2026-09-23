"""Manual employee entry, DC snapshot, and expected-return write-path tests."""

from datetime import date
from types import SimpleNamespace
from unittest.mock import MagicMock, patch
from uuid import uuid4

import pytest
from sqlalchemy import create_engine, event
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session, sessionmaker
from sqlalchemy.pool import StaticPool

from modules.asset.domain.enums import AssignmentEmployeeSource
from modules.asset.domain.exceptions import AssignmentValidationError, DcChallanValidationError
from modules.asset.models.asset_assignment import AstAssetAssignment
from modules.asset.schemas import AssetAssignmentResponse
from modules.asset.service.assignment_service import AssignmentService
from modules.asset.service.assignment_validator import AssignmentValidator
from modules.asset.service.dc_challan_service import DcChallanService
from modules.asset.service.dc_challan_validator import (
    employee_email_missing,
    employee_phone_missing,
    employee_snapshots_ready,
    is_manual_entry_challan,
)
from modules.foundation.domain.value_objects import TenantContext
from modules.foundation.models.workflow import WfInstance


def _ctx() -> TenantContext:
    return TenantContext(
        tenant_id=uuid4(),
        user_id=uuid4(),
        user_type="employee",
        company_id=uuid4(),
        branch_id=uuid4(),
    )


def _asset(company_id, **overrides):
    base = dict(
        id=uuid4(),
        company_id=company_id,
        branch_id=uuid4(),
        status="active",
        operational_status="READY_TO_MOVE",
        is_shared=False,
    )
    base.update(overrides)
    return SimpleNamespace(**base)


def _sqlite_session() -> tuple[Session, object]:
    raw = create_engine(
        "sqlite://",
        connect_args={"check_same_thread": False},
        poolclass=StaticPool,
    )

    @event.listens_for(raw, "connect")
    def _fk_off(dbapi_conn, _record) -> None:  # noqa: ANN001
        cursor = dbapi_conn.cursor()
        cursor.execute("PRAGMA foreign_keys=OFF")
        cursor.close()

    engine = raw.execution_options(schema_translate_map={"asset": None, "foundation": None})
    WfInstance.__table__.create(bind=engine, checkfirst=True)
    AstAssetAssignment.__table__.create(bind=engine, checkfirst=True)
    SessionLocal = sessionmaker(bind=engine, autocommit=False, autoflush=False)
    return SessionLocal(), raw


def test_manual_entry_create_succeeds_with_required_fields() -> None:
    validator = AssignmentValidator(MagicMock())
    ctx = _ctx()
    asset = _asset(ctx.company_id)
    with (
        patch.object(validator._assets, "get", return_value=asset),
        patch.object(validator._transfers, "find_pending_for_asset", return_value=None),
        patch.object(validator._assignments, "find_pending_or_active_for_asset", return_value=None),
    ):
        validator.validate_create_fields(
            ctx,
            company_id=ctx.company_id,
            fields={
                "asset_id": asset.id,
                "allocation_type": "employee",
                "employee_source": AssignmentEmployeeSource.MANUAL_ENTRY.value,
                "manual_employee_name": "Riya Shah",
                "manual_employee_phone": "9876543210",
                "manual_employee_email": None,
                "manual_employee_deployed_to": "Airtel — Gurugram office",
            },
        )


@pytest.mark.parametrize("missing", ["manual_employee_name", "manual_employee_phone", "manual_employee_deployed_to"])
def test_manual_entry_create_fails_without_required_field(missing: str) -> None:
    validator = AssignmentValidator(MagicMock())
    ctx = _ctx()
    asset = _asset(ctx.company_id)
    fields = {
        "asset_id": asset.id,
        "allocation_type": "employee",
        "employee_source": AssignmentEmployeeSource.MANUAL_ENTRY.value,
        "manual_employee_name": "Riya Shah",
        "manual_employee_phone": "9876543210",
        "manual_employee_deployed_to": "Airtel — Gurugram office",
    }
    fields[missing] = None
    with (
        patch.object(validator._assets, "get", return_value=asset),
        patch.object(validator._transfers, "find_pending_for_asset", return_value=None),
        patch.object(validator._assignments, "find_pending_or_active_for_asset", return_value=None),
    ):
        with pytest.raises(AssignmentValidationError, match="manual_employee"):
            validator.validate_create_fields(ctx, company_id=ctx.company_id, fields=fields)


def test_manual_entry_rejects_employee_id() -> None:
    validator = AssignmentValidator(MagicMock())
    ctx = _ctx()
    asset = _asset(ctx.company_id)
    with (
        patch.object(validator._assets, "get", return_value=asset),
        patch.object(validator._transfers, "find_pending_for_asset", return_value=None),
        patch.object(validator._assignments, "find_pending_or_active_for_asset", return_value=None),
    ):
        with pytest.raises(AssignmentValidationError, match="employee_id must be empty"):
            validator.validate_create_fields(
                ctx,
                company_id=ctx.company_id,
                fields={
                    "asset_id": asset.id,
                    "allocation_type": "employee",
                    "employee_source": AssignmentEmployeeSource.MANUAL_ENTRY.value,
                    "employee_id": uuid4(),
                    "manual_employee_name": "Riya Shah",
                    "manual_employee_phone": "9876543210",
                    "manual_employee_deployed_to": "Airtel",
                },
            )


def test_create_does_not_write_expected_return_at() -> None:
    svc = AssignmentService(MagicMock())
    ctx = _ctx()
    asset = _asset(ctx.company_id, branch_id=ctx.branch_id)
    created = SimpleNamespace(id=uuid4(), document_number="ASN-1")
    with (
        patch.object(svc._scope, "resolve_company_id", return_value=ctx.company_id),
        patch.object(svc._scope, "validate_branch_access"),
        patch.object(svc._validator, "validate_create_fields", return_value={}),
        patch.object(
            svc._validator,
            "allocation_identity_payload",
            return_value={
                "employee_id": uuid4(),
                "employee_source": "MASTER_DATA",
                "manual_employee_name": None,
                "manual_employee_phone": None,
                "manual_employee_email": None,
                "manual_employee_deployed_to": None,
                "department_id": None,
                "project_id": None,
            },
        ),
        patch.object(svc._assets, "get", return_value=asset),
        patch.object(svc._numbers, "generate", return_value="ASN-1"),
        patch.object(svc._repo, "create", return_value=created) as create,
        patch.object(svc._audit, "log_entity_change"),
    ):
        svc.create(
            ctx,
            branch_id=ctx.branch_id,
            asset_id=asset.id,
            allocation_type="employee",
            employee_id=uuid4(),
            expected_return_at=date(2026, 12, 1),
        )
        kwargs = create.call_args.kwargs
        assert "expected_return_at" not in kwargs


def test_response_deserializes_legacy_expected_return() -> None:
    dto = AssetAssignmentResponse(
        id=uuid4(),
        document_number="ASN-1",
        asset_id=uuid4(),
        allocation_type="employee",
        employee_id=uuid4(),
        employee_source="MASTER_DATA",
        department_id=None,
        project_id=None,
        allocated_at=None,
        expected_return_at=date(2026, 12, 1),
        returned_at=None,
        status="draft",
        delivery_reference_status="pending",
        workflow_status=None,
        workflow_instance_id=None,
        company_id=uuid4(),
        branch_id=uuid4(),
        version=1,
    )
    assert dto.expected_return_at == date(2026, 12, 1)


def test_check_rejects_manual_entry_with_employee_id() -> None:
    session, raw = _sqlite_session()
    ctx = _ctx()
    row = AstAssetAssignment(
        id=uuid4(),
        tenant_id=ctx.tenant_id,
        company_id=ctx.company_id,
        branch_id=ctx.branch_id,
        document_number="AASN-CK-1",
        asset_id=uuid4(),
        allocation_type="employee",
        employee_id=uuid4(),
        employee_source="MANUAL_ENTRY",
        manual_employee_name="Riya Shah",
        manual_employee_phone="9876543210",
        manual_employee_deployed_to="Airtel",
        status="draft",
        delivery_reference_status="pending",
        delivery_challan_signature_status="not_signed",
        is_deleted=False,
        version=1,
    )
    session.add(row)
    with pytest.raises(IntegrityError):
        session.flush()
    session.close()
    raw.dispose()


def test_check_rejects_manual_fields_on_non_employee_allocation() -> None:
    session, raw = _sqlite_session()
    ctx = _ctx()
    row = AstAssetAssignment(
        id=uuid4(),
        tenant_id=ctx.tenant_id,
        company_id=ctx.company_id,
        branch_id=ctx.branch_id,
        document_number="AASN-CK-2",
        asset_id=uuid4(),
        allocation_type="warehouse",
        employee_id=None,
        employee_source=None,
        manual_employee_name="Should not exist",
        manual_employee_phone=None,
        manual_employee_deployed_to=None,
        status="draft",
        delivery_reference_status="pending",
        delivery_challan_signature_status="not_signed",
        is_deleted=False,
        version=1,
    )
    session.add(row)
    with pytest.raises(IntegrityError):
        session.flush()
    session.close()
    raw.dispose()


def test_check_accepts_manual_entry_row() -> None:
    session, raw = _sqlite_session()
    ctx = _ctx()
    row = AstAssetAssignment(
        id=uuid4(),
        tenant_id=ctx.tenant_id,
        company_id=ctx.company_id,
        branch_id=ctx.branch_id,
        document_number="AASN-CK-3",
        asset_id=uuid4(),
        allocation_type="employee",
        employee_id=None,
        employee_source="MANUAL_ENTRY",
        manual_employee_name="Riya Shah",
        manual_employee_phone="9876543210",
        manual_employee_email=None,
        manual_employee_deployed_to="Airtel — Gurugram office",
        status="draft",
        delivery_reference_status="pending",
        delivery_challan_signature_status="not_signed",
        is_deleted=False,
        version=1,
    )
    session.add(row)
    session.flush()
    assert row.employee_id is None
    session.close()
    raw.dispose()


def test_dc_create_snapshots_manual_employee() -> None:
    svc = DcChallanService(MagicMock())
    svc._audit.log_entity_change = MagicMock()
    ctx = _ctx()
    asset = SimpleNamespace(
        id=uuid4(),
        company_id=ctx.company_id,
        branch_id=ctx.branch_id,
        asset_name="Laptop",
        asset_code="AST-1",
        make="Dell",
        model="XPS",
        serial_number="SN-1",
        purchase_cost=None,
        operational_status="READY_TO_MOVE",
    )
    assignment = SimpleNamespace(
        id=uuid4(),
        asset_id=asset.id,
        allocation_type="employee",
        employee_id=None,
        employee_source="MANUAL_ENTRY",
        manual_employee_name="Riya Shah",
        manual_employee_phone="9876543210",
        manual_employee_email=None,
        manual_employee_deployed_to="Airtel — Gurugram office",
        document_number="ASN-1",
        delivery_reference_status="pending",
        delivery_reference_number=None,
    )
    created = SimpleNamespace(id=uuid4(), dc_number="DC-1", status="PENDING")
    with (
        patch.object(svc._validator, "require_asset", return_value=asset),
        patch.object(svc._scope, "validate_company_access"),
        patch.object(svc._validator, "validate_create_eligibility"),
        patch.object(svc._validator, "require_assignment", return_value=assignment),
        patch.object(svc._validator, "validate_employee_assignment"),
        patch.object(svc._numbers, "generate", return_value="DC-1"),
        patch.object(svc._repo, "create", return_value=created) as create,
        patch.object(svc, "_sync_assignment_delivery_reference"),
    ):
        svc.create(ctx, asset_id=asset.id, assignment_id=assignment.id)
        kwargs = create.call_args.kwargs
        assert kwargs["employee_id"] is None
        assert kwargs["employee_code"] is None
        assert kwargs["employee_name"] == "Riya Shah"
        assert kwargs["employee_phone"] == "9876543210"
        assert kwargs["employee_email"] is None
        assert kwargs["deployed_to"] == "Airtel — Gurugram office"


def test_send_to_scm_manual_requires_name_and_phone() -> None:
    ready = SimpleNamespace(
        employee_id=None,
        employee_code=None,
        employee_name="Riya Shah",
        employee_phone="9876543210",
        employee_email=None,
        deployed_to="Airtel",
    )
    assert is_manual_entry_challan(ready) is True
    assert employee_snapshots_ready(ready) is True
    assert employee_email_missing(ready) is True
    assert employee_phone_missing(ready) is False
    blocked = SimpleNamespace(
        employee_id=None,
        employee_code=None,
        employee_name="Riya Shah",
        employee_phone="",
        employee_email=None,
        deployed_to="Airtel",
    )
    assert employee_snapshots_ready(blocked) is False


def test_send_to_scm_manual_allows_blank_email() -> None:
    svc = DcChallanService(MagicMock())
    svc._scm.send_dc_request = MagicMock()
    ctx = _ctx()
    row = SimpleNamespace(
        id=uuid4(),
        dc_number="DC-1",
        status="PENDING",
        employee_id=None,
        employee_code=None,
        employee_name="Riya Shah",
        employee_phone="9876543210",
        employee_email=None,
        deployed_to="Airtel",
        asset_name="Laptop",
        asset_tag="AST-1",
        make=None,
        model=None,
        serial_number=None,
        purchase_cost=None,
    )
    sent = SimpleNamespace(**{**row.__dict__, "status": "SENT_TO_SCM"})
    with (
        patch.object(svc, "get", return_value=row),
        patch.object(svc._repo, "update", return_value=sent),
        patch.object(svc._audit, "log_entity_change"),
    ):
        result = svc.send_to_scm(ctx, row.id)
    assert result.status == "SENT_TO_SCM"
    payload = svc._scm.send_dc_request.call_args.kwargs["employee_snapshot"]
    assert payload["employee_code"] is None
    assert payload["deployed_to"] == "Airtel"


def test_send_to_scm_master_data_still_requires_code_name_email() -> None:
    svc = DcChallanService(MagicMock())
    svc._scm.send_dc_request = MagicMock()
    ctx = _ctx()
    row = SimpleNamespace(
        id=uuid4(),
        dc_number="DC-1",
        status="PENDING",
        employee_id=uuid4(),
        employee_code="E-1",
        employee_name="Ada",
        employee_phone="1",
        employee_email="",
        deployed_to=None,
    )
    with patch.object(svc, "get", return_value=row):
        with pytest.raises(DcChallanValidationError, match="code, name, and email"):
            svc.send_to_scm(ctx, row.id)
    svc._scm.send_dc_request.assert_not_called()
