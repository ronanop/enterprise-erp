"""CR-004 Phase 5A-2 — assignment enrichment business layer tests."""

from __future__ import annotations

from datetime import datetime, timezone
from types import SimpleNamespace
from unittest.mock import MagicMock, patch
from uuid import uuid4

import pytest

from modules.asset.domain import assignment_enrichment as enrich
from modules.asset.domain.exceptions import AssignmentValidationError
from modules.asset.models.asset_assignment import AstAssetAssignment
from modules.asset.repository.asset_assignment_repository import AssetAssignmentRepository
from modules.asset.schemas import AssetAssignmentReturnRequest
from modules.asset.service.assignment_service import AssignmentService
from modules.asset.service.assignment_validator import AssignmentValidator
from modules.foundation.domain.value_objects import TenantContext


def _ctx() -> TenantContext:
    return TenantContext(
        tenant_id=uuid4(),
        user_id=uuid4(),
        user_type="employee",
        company_id=uuid4(),
        branch_id=uuid4(),
    )


# --- Domain: delivery reference ---


@pytest.mark.parametrize("status", ("not_applicable", "pending", "issued", "received"))
def test_delivery_reference_status_accepts_locked_values(status: str) -> None:
    assert enrich.validate_delivery_reference_status(status) == status


def test_delivery_reference_status_defaults_to_not_applicable() -> None:
    assert enrich.validate_delivery_reference_status(None) == "not_applicable"


def test_invalid_delivery_reference_status_raises() -> None:
    with pytest.raises(AssignmentValidationError, match="delivery_reference_status"):
        enrich.validate_delivery_reference_status("shipped")


def test_number_required_when_issued() -> None:
    with pytest.raises(AssignmentValidationError, match="delivery_reference_number is required"):
        enrich.validate_delivery_reference_pair(number=None, status="issued")


def test_number_required_when_received() -> None:
    with pytest.raises(AssignmentValidationError, match="delivery_reference_number is required"):
        enrich.validate_delivery_reference_pair(number=None, status="received")


def test_number_forbidden_when_not_applicable() -> None:
    with pytest.raises(AssignmentValidationError, match="must be empty"):
        enrich.validate_delivery_reference_pair(number="DC-1", status="not_applicable")


def test_pending_allows_missing_number() -> None:
    number, status = enrich.validate_delivery_reference_pair(number=None, status="pending")
    assert number is None
    assert status == "pending"


def test_pair_normalizes_trimmed_number() -> None:
    number, status = enrich.validate_delivery_reference_pair(number="  DC-9  ", status="issued")
    assert number == "DC-9"
    assert status == "issued"


def test_delivery_reference_number_max_length() -> None:
    with pytest.raises(AssignmentValidationError, match="at most"):
        enrich.validate_delivery_reference_number("x" * 101)


def test_delivery_reference_rejects_control_chars() -> None:
    with pytest.raises(AssignmentValidationError, match="invalid characters"):
        enrich.validate_delivery_reference_number("DC\x00-1")


# --- Domain: remarks ---


def test_assignment_remarks_strips_whitespace() -> None:
    assert enrich.validate_assignment_remarks("  note  ") == "note"


def test_assignment_remarks_blank_becomes_none() -> None:
    assert enrich.validate_assignment_remarks("   ") is None


def test_assignment_remarks_max_length() -> None:
    with pytest.raises(AssignmentValidationError, match="assignment_remarks"):
        enrich.validate_assignment_remarks("a" * 4001)


def test_return_remarks_on_draft_rejected() -> None:
    with pytest.raises(AssignmentValidationError, match="returning"):
        enrich.validate_draft_enrichment_fields(return_remarks="x")


def test_employee_issue_requires_delivery_status() -> None:
    with pytest.raises(AssignmentValidationError, match="delivery_reference_status is required"):
        enrich.validate_employee_issue_enrichment(delivery_reference_status="not_applicable")


# --- Validator ---


def test_validator_return_request_maps_good() -> None:
    v = AssignmentValidator(MagicMock())
    assert v.validate_return_request(return_condition="good") == "return_to_ready"


def test_validator_return_request_invalid_condition() -> None:
    v = AssignmentValidator(MagicMock())
    with pytest.raises(AssignmentValidationError):
        v.validate_return_request(return_condition="broken")


def test_validator_return_request_reason_too_long() -> None:
    v = AssignmentValidator(MagicMock())
    with pytest.raises(AssignmentValidationError, match="reason"):
        v.validate_return_request(return_condition="good", reason="r" * 501)


def test_submit_blocks_employee_without_delivery_ref() -> None:
    v = AssignmentValidator(MagicMock())
    row = SimpleNamespace(
        id=uuid4(),
        status="draft",
        asset_id=uuid4(),
        company_id=uuid4(),
        allocation_type="employee",
        employee_id=uuid4(),
        department_id=None,
        project_id=None,
        delivery_reference_number=None,
        delivery_reference_status="not_applicable",
        assignment_remarks=None,
    )
    asset = SimpleNamespace(id=row.asset_id, status="active", is_shared=True)
    with patch.object(v._assets, "get", return_value=asset):
        with patch.object(v._master, "get_employee", return_value=MagicMock()):
            with patch.object(v._transfers, "find_pending_for_asset", return_value=None):
                with patch.object(
                    v._assignments, "find_pending_or_active_for_asset", return_value=None
                ):
                    with pytest.raises(AssignmentValidationError, match="delivery_reference_status"):
                        v.validate_submit_readiness(_ctx(), row)


def test_submit_allows_department_without_delivery_ref() -> None:
    v = AssignmentValidator(MagicMock())
    row = SimpleNamespace(
        id=uuid4(),
        status="draft",
        asset_id=uuid4(),
        company_id=uuid4(),
        allocation_type="department",
        employee_id=None,
        department_id=uuid4(),
        project_id=None,
        delivery_reference_number=None,
        delivery_reference_status="not_applicable",
        assignment_remarks=None,
    )
    asset = SimpleNamespace(id=row.asset_id, status="active", is_shared=True)
    with patch.object(v._assets, "get", return_value=asset):
        with patch.object(v._org, "get_department", return_value=SimpleNamespace(company_id=row.company_id)):
            with patch.object(v._transfers, "find_pending_for_asset", return_value=None):
                with patch.object(
                    v._assignments, "find_pending_or_active_for_asset", return_value=None
                ):
                    v.validate_submit_readiness(_ctx(), row)


def test_create_rejects_return_remarks_in_fields() -> None:
    v = AssignmentValidator(MagicMock())
    ctx = _ctx()
    asset = SimpleNamespace(
        id=uuid4(),
        company_id=ctx.company_id,
        branch_id=uuid4(),
        status="active",
        is_shared=True,
    )
    with patch.object(v._assets, "get", return_value=asset):
        with patch.object(v._master, "get_employee", return_value=MagicMock()):
            with patch.object(v._transfers, "find_pending_for_asset", return_value=None):
                with patch.object(
                    v._assignments, "find_pending_or_active_for_asset", return_value=None
                ):
                    with pytest.raises(AssignmentValidationError, match="return_remarks"):
                        v.validate_create_fields(
                            ctx,
                            company_id=ctx.company_id,
                            fields={
                                "asset_id": asset.id,
                                "allocation_type": "employee",
                                "employee_id": uuid4(),
                                "return_remarks": "nope",
                            },
                        )


# --- Service ---


def test_create_persists_enrichment_and_audits() -> None:
    svc = AssignmentService(MagicMock())
    ctx = _ctx()
    asset_id = uuid4()
    branch_id = ctx.branch_id
    asset = SimpleNamespace(
        id=asset_id,
        company_id=ctx.company_id,
        branch_id=branch_id,
        status="active",
        is_shared=True,
    )
    fields = {
        "asset_id": asset_id,
        "allocation_type": "employee",
        "employee_id": uuid4(),
        "delivery_reference_number": "CH-1",
        "delivery_reference_status": "issued",
        "assignment_remarks": "Bag included",
    }
    created = SimpleNamespace(id=uuid4(), document_number="AASN-1")
    with patch.object(svc._scope, "resolve_company_id", return_value=ctx.company_id):
        with patch.object(svc._scope, "validate_branch_access"):
            with patch.object(svc._validator, "validate_create_fields", return_value={
                "delivery_reference_number": "CH-1",
                "delivery_reference_status": "issued",
                "assignment_remarks": "Bag included",
                "return_remarks": None,
            }):
                with patch.object(svc._assets, "get", return_value=asset):
                    with patch.object(svc._numbers, "generate", return_value="AASN-1"):
                        with patch.object(svc._repo, "create", return_value=created) as mock_create:
                            with patch.object(svc._audit, "log_entity_change") as audit:
                                svc.create(ctx, branch_id=branch_id, **fields)
    kwargs = mock_create.call_args.kwargs
    assert kwargs["delivery_reference_number"] == "CH-1"
    assert kwargs["delivery_reference_status"] == "issued"
    assert kwargs["assignment_remarks"] == "Bag included"
    audit.assert_called_once()
    assert audit.call_args.kwargs["new_value"]["delivery_reference_number"] == "CH-1"


def test_return_persists_return_remarks_via_repository() -> None:
    svc = AssignmentService(MagicMock())
    ctx = _ctx()
    row_id = uuid4()
    asset_id = uuid4()
    row = SimpleNamespace(
        id=row_id,
        status="active",
        asset_id=asset_id,
        allocation_type="employee",
        employee_id=uuid4(),
    )
    asset = SimpleNamespace(
        id=asset_id,
        version=2,
        custodian_employee_id=row.employee_id,
        master_asset_id=None,
    )
    with patch.object(svc, "get", return_value=row):
        with patch.object(svc._validator, "validate_return_readiness"):
            with patch.object(svc._validator, "validate_return_request", return_value="return_to_ready"):
                with patch.object(svc._assets, "lock_for_update", return_value=asset):
                    with patch.object(svc._operational, "apply_action", return_value="READY_TO_MOVE"):
                        with patch.object(svc._assets, "get", return_value=asset):
                            with patch.object(svc._repo, "complete_return", return_value=row) as complete:
                                with patch.object(svc._audit, "log_entity_change"):
                                    svc.return_assignment(
                                        ctx,
                                        row_id,
                                        return_condition="good",
                                        remarks="  ok  ",
                                    )
    complete.assert_called_once()
    assert complete.call_args.kwargs["return_remarks"] == "ok"
    assert complete.call_args.kwargs["status"] == "returned"


# --- Repository ---


def test_complete_return_delegates_to_update() -> None:
    from sqlalchemy import create_engine, event
    from sqlalchemy.orm import sessionmaker
    from sqlalchemy.pool import StaticPool

    from modules.foundation.models.workflow import WfInstance

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
    session = SessionLocal()
    ctx = _ctx()
    now = datetime.now(timezone.utc)
    row = AstAssetAssignment(
        id=uuid4(),
        tenant_id=ctx.tenant_id,
        company_id=ctx.company_id,
        branch_id=ctx.branch_id,
        document_number="AASN-RET",
        asset_id=uuid4(),
        allocation_type="employee",
        employee_id=uuid4(),
        status="active",
        delivery_reference_status="issued",
        is_deleted=False,
        version=1,
        created_at=now,
        updated_at=now,
        created_by=ctx.user_id,
        updated_by=ctx.user_id,
    )
    session.add(row)
    session.flush()
    repo = AssetAssignmentRepository(session)
    returned_at = datetime.now(timezone.utc)
    updated = repo.complete_return(
        ctx,
        row.id,
        status="returned",
        returned_at=returned_at,
        return_remarks="Done",
    )
    assert updated is not None
    assert updated.return_remarks == "Done"
    assert updated.status == "returned"
    session.close()
    raw.dispose()


# --- API / OpenAPI ---


def test_openapi_return_request_schema() -> None:
    from main import app

    schema = app.openapi()["components"]["schemas"]["AssetAssignmentReturnRequest"]["properties"]
    assert "return_condition" in schema
    assert "return_remarks" in schema
    assert "reason" in schema


def test_return_request_defaults_to_good() -> None:
    body = AssetAssignmentReturnRequest()
    assert body.return_condition == "good"


@pytest.mark.parametrize(
    ("condition", "expected"),
    [
        ("outdated", "outdated"),
        ("dead", "dead"),
    ],
)
def test_return_request_accepts_conditions(condition: str, expected: str) -> None:
    body = AssetAssignmentReturnRequest(return_condition=condition)
    assert body.return_condition == expected


def test_openapi_return_route_accepts_body() -> None:
    from main import app

    path = app.openapi()["paths"]["/api/v1/assets/asset-assignments/{row_id}/return"]["post"]
    assert "requestBody" in path


# Additional domain parametrized coverage


@pytest.mark.parametrize("status", ("pending", "issued", "received"))
def test_employee_issue_accepts_non_na_status(status: str) -> None:
    enrich.validate_employee_issue_enrichment(delivery_reference_status=status)


@pytest.mark.parametrize(
    "remarks",
    [None, "short", "multi\nline", "x" * 4000],
)
def test_return_remarks_validation_accepts(remarks: str | None) -> None:
    enrich.validate_return_remarks(remarks)


def test_validate_create_fields_returns_enrichment() -> None:
    v = AssignmentValidator(MagicMock())
    ctx = _ctx()
    asset = SimpleNamespace(
        id=uuid4(),
        company_id=ctx.company_id,
        branch_id=uuid4(),
        status="active",
        is_shared=True,
    )
    with patch.object(v._assets, "get", return_value=asset):
        with patch.object(v._master, "get_employee", return_value=MagicMock()):
            with patch.object(v._transfers, "find_pending_for_asset", return_value=None):
                with patch.object(
                    v._assignments, "find_pending_or_active_for_asset", return_value=None
                ):
                    result = v.validate_create_fields(
                        ctx,
                        company_id=ctx.company_id,
                        fields={
                            "asset_id": asset.id,
                            "allocation_type": "employee",
                            "employee_id": uuid4(),
                            "delivery_reference_status": "pending",
                        },
                    )
    assert result["delivery_reference_status"] == "pending"


def test_return_audit_includes_condition() -> None:
    svc = AssignmentService(MagicMock())
    ctx = _ctx()
    row_id = uuid4()
    row = SimpleNamespace(
        id=row_id,
        status="active",
        asset_id=uuid4(),
        allocation_type="branch",
        employee_id=None,
    )
    asset = SimpleNamespace(id=row.asset_id, version=1, custodian_employee_id=None, master_asset_id=None)
    with patch.object(svc, "get", return_value=row):
        with patch.object(svc._validator, "validate_return_readiness"):
            with patch.object(svc._validator, "validate_return_request", return_value="retire"):
                with patch.object(svc._assets, "lock_for_update", return_value=asset):
                    with patch.object(svc._operational, "apply_action"):
                        with patch.object(svc._assets, "get", return_value=asset):
                            with patch.object(svc._repo, "complete_return", return_value=row):
                                with patch.object(svc._audit, "log_entity_change") as audit:
                                    svc.return_assignment(
                                        ctx,
                                        row_id,
                                        return_condition="outdated",
                                        remarks="old laptop",
                                    )
    payload = audit.call_args.kwargs["new_value"]
    assert payload["return_condition"] == "outdated"
    assert payload["return_remarks"] == "old laptop"
