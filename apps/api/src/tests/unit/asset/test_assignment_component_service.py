"""Unit tests for Sub-phase 4C assignment-component custody + component_type."""

from types import SimpleNamespace
from unittest.mock import MagicMock, patch
from uuid import uuid4

import pytest

from modules.asset.domain.exceptions import AssignmentValidationError, ComponentValidationError
from modules.asset.service.assignment_component_service import (
    AssignmentComponentService,
    assert_charger_serial,
)
from modules.asset.service.component_validator import ComponentValidator
from modules.foundation.domain.value_objects import TenantContext


def _ctx() -> TenantContext:
    return TenantContext(
        tenant_id=uuid4(),
        user_id=uuid4(),
        user_type="employee",
        company_id=uuid4(),
        branch_id=uuid4(),
    )


def test_charger_requires_serial() -> None:
    with pytest.raises(ComponentValidationError, match="serial_number is required"):
        assert_charger_serial("CHARGER", None)
    with pytest.raises(ComponentValidationError, match="serial_number is required"):
        assert_charger_serial("CHARGER", "  ")
    assert_charger_serial("CHARGER", "CHG-1")
    assert_charger_serial("MOUSE", None)


def test_install_rejects_charger_without_serial() -> None:
    validator = ComponentValidator(MagicMock())
    ctx = _ctx()
    asset_id = uuid4()
    asset = SimpleNamespace(
        id=asset_id, company_id=ctx.company_id, status="active", branch_id=None
    )
    with patch.object(validator._assets, "get", return_value=asset):
        with patch.object(validator._components, "find_active_by_code", return_value=None):
            with pytest.raises(ComponentValidationError, match="serial_number is required"):
                validator.validate_install_fields(
                    ctx,
                    company_id=ctx.company_id,
                    fields={
                        "asset_id": asset_id,
                        "component_code": "CHG-1",
                        "component_name": "Dell 65W",
                        "component_type": "CHARGER",
                    },
                )


def test_install_accepts_typed_mouse_without_serial() -> None:
    validator = ComponentValidator(MagicMock())
    ctx = _ctx()
    asset_id = uuid4()
    asset = SimpleNamespace(
        id=asset_id, company_id=ctx.company_id, status="active", branch_id=None
    )
    with patch.object(validator._assets, "get", return_value=asset):
        with patch.object(validator._components, "find_active_by_code", return_value=None):
            fields = {
                "asset_id": asset_id,
                "component_code": "MOU-1",
                "component_name": "Logitech",
                "component_type": "mouse",
            }
            validator.validate_install_fields(ctx, company_id=ctx.company_id, fields=fields)
            assert fields["component_type"] == "MOUSE"


def test_reconcile_return_requires_all_issued_components() -> None:
    db = MagicMock()
    svc = AssignmentComponentService(db)
    assignment = SimpleNamespace(id=uuid4(), asset_id=uuid4(), company_id=uuid4())
    c1, c2 = uuid4(), uuid4()
    issued = [
        SimpleNamespace(id=uuid4(), component_id=c1, version=1),
        SimpleNamespace(id=uuid4(), component_id=c2, version=1),
    ]
    with patch.object(svc._repo, "list_issued_for_assignment", return_value=issued):
        with pytest.raises(AssignmentValidationError, match="All issued components"):
            svc.reconcile_return(
                _ctx(),
                assignment,
                [{"component_id": c1, "issue_status": "RETURNED"}],
            )


def test_reconcile_return_marks_outcomes() -> None:
    db = MagicMock()
    svc = AssignmentComponentService(db)
    assignment = SimpleNamespace(id=uuid4(), asset_id=uuid4(), company_id=uuid4())
    c1 = uuid4()
    row = SimpleNamespace(id=uuid4(), component_id=c1, version=1)
    with patch.object(svc._repo, "list_issued_for_assignment", return_value=[row]):
        with patch.object(svc._repo, "update", return_value=row) as upd:
            result = svc.reconcile_return(
                _ctx(),
                assignment,
                [{"component_id": c1, "issue_status": "MISSING", "return_remarks": "lost"}],
            )
            assert result == [row]
            kwargs = upd.call_args.kwargs
            assert kwargs["issue_status"] == "MISSING"
            assert kwargs["return_condition"] == "MISSING"
            assert kwargs["return_remarks"] == "lost"


def test_set_components_rejects_wrong_asset() -> None:
    db = MagicMock()
    svc = AssignmentComponentService(db)
    ctx = _ctx()
    assignment = SimpleNamespace(
        id=uuid4(),
        asset_id=uuid4(),
        company_id=ctx.company_id,
        status="draft",
    )
    component_id = uuid4()
    component = SimpleNamespace(
        id=component_id,
        company_id=ctx.company_id,
        asset_id=uuid4(),  # different asset
        status="active",
        component_code="MOU-1",
    )
    with patch.object(svc._components, "lock_for_update", return_value=component):
        with pytest.raises(AssignmentValidationError, match="does not belong to the selected asset"):
            svc.set_components(ctx, assignment, [component_id])


def test_set_components_rejects_already_issued() -> None:
    db = MagicMock()
    svc = AssignmentComponentService(db)
    ctx = _ctx()
    assignment = SimpleNamespace(
        id=uuid4(),
        asset_id=uuid4(),
        company_id=ctx.company_id,
        status="draft",
    )
    component_id = uuid4()
    component = SimpleNamespace(
        id=component_id,
        company_id=ctx.company_id,
        asset_id=assignment.asset_id,
        status="active",
        component_code="CHG-1",
    )
    blocking = SimpleNamespace(issue_status="ISSUED")
    with patch.object(svc._components, "lock_for_update", return_value=component):
        with patch.object(svc._repo, "find_blocking_for_component", return_value=blocking):
            with pytest.raises(AssignmentValidationError, match="already issued"):
                svc.set_components(ctx, assignment, [component_id])


def test_unique_integrity_error_maps_to_already_issued_message() -> None:
    from sqlalchemy.exc import IntegrityError

    from modules.asset.service.assignment_component_service import (
        _is_active_issue_unique_violation,
    )

    UniqueViolation = type("UniqueViolation", (Exception,), {})
    orig = UniqueViolation(
        'duplicate key value violates unique constraint "uq_ast_assignment_component_active_issue"'
    )
    exc = IntegrityError("INSERT INTO ast_assignment_component ...", {}, orig)
    assert _is_active_issue_unique_violation(exc) is True

    db = MagicMock()
    svc = AssignmentComponentService(db)
    ctx = _ctx()
    assignment = SimpleNamespace(
        id=uuid4(),
        asset_id=uuid4(),
        company_id=ctx.company_id,
        status="draft",
    )
    component_id = uuid4()
    component = SimpleNamespace(
        id=component_id,
        company_id=ctx.company_id,
        asset_id=assignment.asset_id,
        status="active",
        component_code="CHG-1",
    )
    with patch.object(svc._components, "lock_for_update", return_value=component):
        with patch.object(svc._repo, "find_blocking_for_component", return_value=None):
            with patch.object(svc._repo, "replace_draft_selection", side_effect=exc):
                with pytest.raises(
                    AssignmentValidationError,
                    match="already issued on another assignment",
                ):
                    svc.set_components(ctx, assignment, [component_id])


def test_not_null_integrity_error_is_not_mapped_to_already_issued() -> None:
    from sqlalchemy.exc import IntegrityError

    from modules.asset.service.assignment_component_service import (
        _is_active_issue_unique_violation,
    )

    NotNullViolation = type("NotNullViolation", (Exception,), {})
    orig = NotNullViolation(
        'null value in column "created_at" of relation "ast_assignment_component"'
    )
    exc = IntegrityError("INSERT INTO ast_assignment_component ...", {}, orig)
    assert _is_active_issue_unique_violation(exc) is False

    db = MagicMock()
    svc = AssignmentComponentService(db)
    ctx = _ctx()
    assignment = SimpleNamespace(
        id=uuid4(),
        asset_id=uuid4(),
        company_id=ctx.company_id,
        status="draft",
    )
    component_id = uuid4()
    component = SimpleNamespace(
        id=component_id,
        company_id=ctx.company_id,
        asset_id=assignment.asset_id,
        status="active",
        component_code="CHG-1",
    )
    with patch.object(svc._components, "lock_for_update", return_value=component):
        with patch.object(svc._repo, "find_blocking_for_component", return_value=None):
            with patch.object(svc._repo, "replace_draft_selection", side_effect=exc):
                with pytest.raises(IntegrityError):
                    svc.set_components(ctx, assignment, [component_id])


def test_assignment_component_repository_create_sets_timestamps() -> None:
    from datetime import datetime

    from modules.asset.repository.assignment_component_repository import (
        AssignmentComponentRepository,
    )

    db = MagicMock()
    repo = AssignmentComponentRepository(db)
    ctx = _ctx()
    row = repo.create(
        ctx,
        company_id=ctx.company_id,
        assignment_id=uuid4(),
        component_id=uuid4(),
        issue_status="ISSUED",
        issued_at=None,
    )
    assert row.created_at is not None
    assert row.updated_at is not None
    assert isinstance(row.created_at, datetime)
    assert row.created_at.tzinfo is not None
    assert row.issued_at is None
    db.add.assert_called_once()
    db.flush.assert_called_once()
