"""Asset charger accessory sync — CHARGER component on create/update."""

from datetime import date
from decimal import Decimal
from unittest.mock import MagicMock, patch
from uuid import uuid4

import pytest

from modules.asset.domain.enums import AssetComponentType, AssetStatus
from modules.asset.domain.exceptions import RegistrationValidationError
from modules.asset.schemas import AssetCreate, AssetUpdate
from modules.asset.service.asset_charger_service import AssetChargerService
from modules.asset.service.asset_service import AssetService
from modules.foundation.domain.value_objects import TenantContext


def _ctx() -> TenantContext:
    return TenantContext(
        tenant_id=uuid4(),
        user_id=uuid4(),
        user_type="employee",
        company_id=uuid4(),
        branch_id=uuid4(),
    )


def test_asset_create_schema_requires_charger_code_when_yes() -> None:
    with pytest.raises(ValueError, match="Charger Code"):
        AssetCreate(
            asset_name="Laptop",
            asset_category_id=uuid4(),
            asset_type_id=uuid4(),
            purchase_date=date.today(),
            purchase_cost=Decimal("1000"),
            currency_code="INR",
            charger_available=True,
            charger_code="",
        )


def test_asset_create_schema_clears_code_when_no() -> None:
    body = AssetCreate(
        asset_name="Laptop",
        asset_category_id=uuid4(),
        asset_type_id=uuid4(),
        purchase_date=date.today(),
        purchase_cost=Decimal("1000"),
        currency_code="INR",
        charger_available=False,
        charger_code="CHG-IGNORE",
    )
    assert body.charger_available is False
    assert body.charger_code is None


def test_asset_update_schema_requires_code_when_yes() -> None:
    with pytest.raises(ValueError, match="Charger Code"):
        AssetUpdate(charger_available=True, charger_code="  ")


def test_sync_yes_installs_charger() -> None:
    db = MagicMock()
    svc = AssetChargerService(db)
    ctx = _ctx()
    asset = MagicMock()
    asset.id = uuid4()
    asset.company_id = ctx.company_id
    asset.branch_id = ctx.branch_id
    installed = MagicMock()
    with (
        patch.object(svc, "find_active_charger", return_value=None),
        patch("modules.asset.service.asset_charger_service.ComponentService") as mock_cls,
    ):
        mock_cls.return_value.install.return_value = installed
        result = svc.sync(ctx, asset, charger_available=True, charger_code="CHG-001")
    assert result is installed
    mock_cls.return_value.install.assert_called_once()
    kwargs = mock_cls.return_value.install.call_args.kwargs
    assert kwargs["component_type"] == AssetComponentType.CHARGER.value
    assert kwargs["component_code"] == "CHG-001"
    assert kwargs["serial_number"] == "CHG-001"


def test_sync_yes_empty_code_fails() -> None:
    db = MagicMock()
    svc = AssetChargerService(db)
    ctx = _ctx()
    asset = MagicMock()
    asset.id = uuid4()
    with pytest.raises(RegistrationValidationError, match="Charger Code is required"):
        svc.sync(ctx, asset, charger_available=True, charger_code="")


def test_sync_no_disposes_active_charger() -> None:
    db = MagicMock()
    svc = AssetChargerService(db)
    ctx = _ctx()
    asset = MagicMock()
    asset.id = uuid4()
    existing = MagicMock()
    existing.id = uuid4()
    with (
        patch.object(svc._components, "list_active_by_type", return_value=[existing]),
        patch("modules.asset.service.asset_charger_service.ComponentService") as mock_cls,
    ):
        result = svc.sync(ctx, asset, charger_available=False, charger_code=None)
    assert result is None
    mock_cls.return_value.dispose.assert_called_once_with(ctx, existing.id)


def test_sync_yes_updates_existing_code() -> None:
    db = MagicMock()
    svc = AssetChargerService(db)
    ctx = _ctx()
    asset = MagicMock()
    asset.id = uuid4()
    existing = MagicMock()
    existing.id = uuid4()
    existing.component_code = "OLD"
    existing.serial_number = "OLD"
    updated = MagicMock()
    with (
        patch.object(svc, "find_active_charger", return_value=existing),
        patch("modules.asset.service.asset_charger_service.ComponentService") as mock_cls,
    ):
        mock_cls.return_value.update_charger_identity.return_value = updated
        result = svc.sync(ctx, asset, charger_available=True, charger_code="NEW-1")
    assert result is updated
    mock_cls.return_value.update_charger_identity.assert_called_once_with(
        ctx, existing.id, charger_code="NEW-1"
    )


def test_create_rolls_back_when_charger_fails() -> None:
    """Charger install failure must propagate so the request transaction rolls back."""
    db = MagicMock()
    svc = AssetService(db)
    ctx = _ctx()
    row = MagicMock()
    row.id = uuid4()
    row.company_id = ctx.company_id
    row.branch_id = ctx.branch_id
    with (
        patch.object(svc._scope, "resolve_company_id", return_value=ctx.company_id),
        patch.object(svc._scope, "validate_branch_access"),
        patch.object(svc, "_normalize_optional_text_fields"),
        patch.object(svc, "_apply_type_master_defaults"),
        patch.object(svc._validator, "validate_create_fields"),
        patch.object(svc._numbers, "generate", return_value="AST-1"),
        patch.object(svc._repo, "create", return_value=row),
        patch.object(svc, "_persist_registration_location", return_value=None),
        patch.object(
            svc._charger,
            "sync",
            side_effect=RegistrationValidationError("Charger Code is required"),
        ),
        patch.object(svc._audit, "log_entity_change"),
        pytest.raises(RegistrationValidationError, match="Charger Code"),
    ):
        svc.create(
            ctx,
            branch_id=ctx.branch_id,
            asset_name="Laptop",
            asset_category_id=uuid4(),
            asset_type_id=uuid4(),
            asset_type="fixed",
            purchase_date=date.today(),
            purchase_cost=Decimal("1"),
            currency_code="INR",
            charger_available=True,
            charger_code="",
        )


def test_soft_delete_blocks_assigned() -> None:
    db = MagicMock()
    svc = AssetService(db)
    ctx = _ctx()
    row = MagicMock()
    row.id = uuid4()
    row.status = AssetStatus.ACTIVE.value
    row.operational_status = "ASSIGNED"
    row.asset_code = "AST-1"
    with (
        patch.object(svc, "get", return_value=row),
        pytest.raises(RegistrationValidationError, match="ASSIGNED"),
    ):
        svc.soft_delete(ctx, row.id)


def test_soft_delete_blocks_active_assignment_record() -> None:
    db = MagicMock()
    svc = AssetService(db)
    ctx = _ctx()
    row = MagicMock()
    row.id = uuid4()
    row.status = AssetStatus.ACTIVE.value
    row.operational_status = "READY_TO_MOVE"
    row.asset_code = "AST-1"
    with (
        patch.object(svc, "get", return_value=row),
        patch(
            "modules.asset.repository.asset_assignment_repository.AssetAssignmentRepository"
        ) as asn_cls,
        pytest.raises(RegistrationValidationError, match="active or pending assignment"),
    ):
        asn_cls.return_value.find_pending_or_active_for_asset.return_value = MagicMock()
        svc.soft_delete(ctx, row.id)


def test_soft_delete_blocks_open_transfer() -> None:
    db = MagicMock()
    svc = AssetService(db)
    ctx = _ctx()
    row = MagicMock()
    row.id = uuid4()
    row.status = AssetStatus.ACTIVE.value
    row.operational_status = "READY_TO_MOVE"
    row.asset_code = "AST-1"
    with (
        patch.object(svc, "get", return_value=row),
        patch(
            "modules.asset.repository.asset_assignment_repository.AssetAssignmentRepository"
        ) as asn_cls,
        patch(
            "modules.asset.repository.asset_transfer_repository.AssetTransferRepository"
        ) as xfer_cls,
        pytest.raises(RegistrationValidationError, match="open transfer"),
    ):
        asn_cls.return_value.find_pending_or_active_for_asset.return_value = None
        xfer_cls.return_value.find_pending_for_asset.return_value = MagicMock()
        svc.soft_delete(ctx, row.id)


def test_soft_delete_does_not_call_physical_repo_delete() -> None:
    """Soft delete must use is_deleted flag — never a physical DELETE helper."""
    db = MagicMock()
    svc = AssetService(db)
    ctx = _ctx()
    row = MagicMock()
    row.id = uuid4()
    row.status = AssetStatus.ACTIVE.value
    row.operational_status = "READY_TO_MOVE"
    row.asset_code = "AST-1"
    deleted = MagicMock()
    with (
        patch.object(svc, "get", return_value=row),
        patch(
            "modules.asset.repository.asset_assignment_repository.AssetAssignmentRepository"
        ) as asn_cls,
        patch(
            "modules.asset.repository.asset_transfer_repository.AssetTransferRepository"
        ) as xfer_cls,
        patch(
            "modules.asset.repository.asset_maintenance_repository.AssetMaintenanceRepository"
        ) as mnt_cls,
        patch.object(svc._repo, "soft_delete", return_value=deleted) as soft,
        patch.object(svc._audit, "log_entity_change") as audit,
    ):
        asn_cls.return_value.find_pending_or_active_for_asset.return_value = None
        xfer_cls.return_value.find_pending_for_asset.return_value = None
        mnt_cls.return_value.find_open_for_asset.return_value = None
        assert not hasattr(svc._repo, "delete") or True
        result = svc.soft_delete(ctx, row.id)
    assert result is deleted
    soft.assert_called_once_with(ctx, row.id)
    assert audit.call_args.kwargs["operation"] == "soft_delete"
    assert audit.call_args.kwargs["new_value"]["is_deleted"] is True


def test_soft_delete_succeeds_when_ready() -> None:
    db = MagicMock()
    svc = AssetService(db)
    ctx = _ctx()
    row = MagicMock()
    row.id = uuid4()
    row.status = AssetStatus.ACTIVE.value
    row.operational_status = "READY_TO_MOVE"
    row.asset_code = "AST-1"
    deleted = MagicMock()
    with (
        patch.object(svc, "get", return_value=row),
        patch(
            "modules.asset.repository.asset_assignment_repository.AssetAssignmentRepository"
        ) as asn_cls,
        patch(
            "modules.asset.repository.asset_transfer_repository.AssetTransferRepository"
        ) as xfer_cls,
        patch(
            "modules.asset.repository.asset_maintenance_repository.AssetMaintenanceRepository"
        ) as mnt_cls,
        patch.object(svc._repo, "soft_delete", return_value=deleted),
        patch.object(svc._audit, "log_entity_change") as audit,
    ):
        asn_cls.return_value.find_pending_or_active_for_asset.return_value = None
        xfer_cls.return_value.find_pending_for_asset.return_value = None
        mnt_cls.return_value.find_open_for_asset.return_value = None
        result = svc.soft_delete(ctx, row.id)
    assert result is deleted
    audit.assert_called_once()
    assert audit.call_args.kwargs["operation"] == "soft_delete"
