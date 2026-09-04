"""Asset component validation rules for FP-ASSET-019."""

from __future__ import annotations

from decimal import Decimal
from uuid import UUID

from sqlalchemy.orm import Session

from core.exceptions import NotFoundException
from modules.asset.adapters.master_data_port import AssetMasterDataAdapter
from modules.asset.domain.enums import (
    ASSET_COMPONENT_TYPE_VALUES,
    AssetComponentStatus,
    AssetComponentType,
    AssetOperationalStatus,
    AssetStatus,
)
from modules.asset.domain.exceptions import ComponentValidationError
from modules.asset.models import AstAssetComponent
from modules.asset.repository.assignment_component_repository import AssignmentComponentRepository
from modules.asset.repository.asset_component_repository import AssetComponentRepository
from modules.asset.repository.asset_repository import AssetRepository
from modules.asset.repository.asset_type_repository import AssetTypeRepository
from modules.asset.service.assignment_component_service import assert_charger_serial
from modules.foundation.domain.value_objects import TenantContext

BLOCKED_ASSET_STATUSES = frozenset(
    {
        AssetStatus.DISPOSED.value,
        AssetStatus.WRITTEN_OFF.value,
    }
)
IMMUTABLE_AFTER_INSTALL = frozenset({"asset_id", "component_code", "component_asset_id"})

_COMPONENT_TYPE_LABELS: dict[str, str] = {
    AssetComponentType.CHARGER.value: "Charger",
    AssetComponentType.MOUSE.value: "Mouse",
    AssetComponentType.KEYBOARD.value: "Keyboard",
    AssetComponentType.CABLE.value: "Cable",
    AssetComponentType.PENDRIVE.value: "Pendrive",
    AssetComponentType.LAPTOP_BAG.value: "Laptop Bag",
    AssetComponentType.OTHER.value: "Other",
}

_READY = AssetOperationalStatus.READY_TO_MOVE.value
_IN_USE = AssetOperationalStatus.IN_USE_AS_COMPONENT.value


class ComponentValidator:
    def __init__(self, db: Session) -> None:
        self._assets = AssetRepository(db)
        self._components = AssetComponentRepository(db)
        self._assignment_components = AssignmentComponentRepository(db)
        self._types = AssetTypeRepository(db)
        self._master = AssetMasterDataAdapter(db)

    @staticmethod
    def type_label(component_type: str | None) -> str:
        key = str(component_type or AssetComponentType.OTHER.value).strip().upper()
        return _COMPONENT_TYPE_LABELS.get(key, key.replace("_", " ").title())

    def validate_install_fields(
        self,
        ctx: TenantContext,
        *,
        company_id: UUID,
        fields: dict,
    ) -> None:
        if fields.get("status") and fields["status"] != AssetComponentStatus.ACTIVE.value:
            raise ComponentValidationError("Component must be installed in active status")

        asset_id = fields.get("asset_id")
        if asset_id is None:
            raise ComponentValidationError("asset_id is required")

        component_type = fields.get("component_type")
        if component_type is None or component_type == "":
            fields["component_type"] = AssetComponentType.OTHER.value
        else:
            normalized = str(component_type).strip().upper()
            if normalized not in ASSET_COMPONENT_TYPE_VALUES:
                raise ComponentValidationError(
                    "component_type must be one of: "
                    + ", ".join(sorted(ASSET_COMPONENT_TYPE_VALUES))
                )
            fields["component_type"] = normalized

        code = fields.get("component_code")
        if code is not None and str(code).strip():
            fields["component_code"] = str(code).strip()
            if len(fields["component_code"]) > 50:
                raise ComponentValidationError("component_code exceeds maximum length")
        else:
            fields["component_code"] = None  # allocated by service

        name = fields.get("component_name")
        if name is not None and str(name).strip():
            fields["component_name"] = str(name).strip()
        else:
            fields["component_name"] = None  # defaulted by service

        if "quantity" in fields and fields.get("quantity") is not None:
            fields["quantity"] = self._validate_quantity(fields["quantity"])

        if "serial_number" in fields and fields.get("serial_number") is not None:
            fields["serial_number"] = self._validate_serial(fields["serial_number"])

        assert_charger_serial(fields.get("component_type"), fields.get("serial_number"))

        asset = self._assets.get(ctx, asset_id)
        if asset is None:
            raise NotFoundException("Asset not found")
        if asset.company_id != company_id:
            raise ComponentValidationError("Asset does not belong to this company")
        if asset.status in BLOCKED_ASSET_STATUSES:
            raise ComponentValidationError(
                "Components cannot be installed on disposed or written-off assets"
            )
        parent_ops = str(getattr(asset, "operational_status", None) or "").strip().upper()
        if parent_ops == _IN_USE:
            raise ComponentValidationError(
                "Cannot install components on an asset that is itself in use as a component"
            )

        child_asset_id = fields.get("component_asset_id")
        if child_asset_id is not None:
            self._validate_attach_child(
                ctx,
                company_id=company_id,
                parent_asset_id=asset_id,
                child_asset_id=child_asset_id,
            )

        if fields.get("component_code") and self._components.find_active_by_code(
            ctx,
            asset_id=asset_id,
            component_code=fields["component_code"],
            exclude_id=fields.get("_exclude_component_id"),
        ):
            raise ComponentValidationError(
                "An active component with this component_code already exists on the asset"
            )

        serial = fields.get("serial_number")
        if serial:
            if self._components.find_active_by_serial(
                ctx, company_id=company_id, serial_number=serial
            ):
                raise ComponentValidationError(
                    "An active component with this serial_number already exists in the company"
                )

        product_id = fields.get("product_id")
        if product_id is not None:
            self._validate_product(ctx, product_id)

        if fields.get("branch_id") is None and asset.branch_id is not None:
            fields["branch_id"] = asset.branch_id

    def _validate_attach_child(
        self,
        ctx: TenantContext,
        *,
        company_id: UUID,
        parent_asset_id: UUID,
        child_asset_id: UUID,
    ) -> None:
        if child_asset_id == parent_asset_id:
            raise ComponentValidationError("An asset cannot be attached as a component of itself")

        child = self._assets.get(ctx, child_asset_id)
        if child is None:
            raise NotFoundException("Component asset not found")
        if child.company_id != company_id:
            raise ComponentValidationError("Component asset does not belong to this company")
        if child.status in BLOCKED_ASSET_STATUSES:
            raise ComponentValidationError(
                "Disposed or written-off assets cannot be attached as components"
            )

        child_ops = str(getattr(child, "operational_status", None) or "").strip().upper()
        if child_ops != _READY:
            raise ComponentValidationError(
                "Only Ready to Move assets can be attached as components"
            )

        type_id = getattr(child, "asset_type_id", None)
        if type_id is None:
            raise ComponentValidationError(
                "Component asset must have an asset type to evaluate eligibility"
            )
        asset_type = self._types.get(ctx, type_id)
        if asset_type is None or not bool(getattr(asset_type, "active", True)):
            raise ComponentValidationError("Component asset type is missing or inactive")
        if not bool(getattr(asset_type, "eligible_as_component", True)):
            raise ComponentValidationError(
                "This asset type is not eligible to be attached as a component"
            )

        existing = self._components.find_active_by_component_asset(
            ctx, component_asset_id=child_asset_id
        )
        if existing:
            raise ComponentValidationError(
                "This asset is already attached as an active component of another asset"
            )

        # Cycle: child must not already host active asset-linked components.
        if self._components.list_active_linked_for_parent(ctx, asset_id=child_asset_id):
            raise ComponentValidationError(
                "Cannot attach an asset that itself has assets attached as components"
            )

    def validate_update_fields(
        self,
        ctx: TenantContext,
        row: AstAssetComponent,
        fields: dict,
    ) -> None:
        if row.status != AssetComponentStatus.ACTIVE.value:
            raise ComponentValidationError(
                "Only active components can be updated"
            )
        if "status" in fields and fields["status"] is not None and fields["status"] != row.status:
            raise ComponentValidationError(
                "status cannot be changed via update; use replace or dispose"
            )
        for key in IMMUTABLE_AFTER_INSTALL:
            if key in fields and fields[key] is not None and fields[key] != getattr(row, key):
                raise ComponentValidationError(f"{key} cannot be changed after installation")

        if "component_name" in fields and fields["component_name"] is not None:
            name = str(fields["component_name"]).strip()
            if not name:
                raise ComponentValidationError("component_name is required")
            fields["component_name"] = name

        if "component_type" in fields and fields["component_type"] is not None:
            normalized = str(fields["component_type"]).strip().upper()
            if normalized not in ASSET_COMPONENT_TYPE_VALUES:
                raise ComponentValidationError(
                    "component_type must be one of: "
                    + ", ".join(sorted(ASSET_COMPONENT_TYPE_VALUES))
                )
            fields["component_type"] = normalized

        if "quantity" in fields and fields.get("quantity") is not None:
            fields["quantity"] = self._validate_quantity(fields["quantity"])

        if "serial_number" in fields and fields.get("serial_number") is not None:
            serial = self._validate_serial(fields["serial_number"])
            fields["serial_number"] = serial
            dup = self._components.find_active_by_serial(
                ctx, company_id=row.company_id, serial_number=serial, exclude_id=row.id
            )
            if dup:
                raise ComponentValidationError(
                    "An active component with this serial_number already exists in the company"
                )

        effective_type = fields.get("component_type", row.component_type)
        effective_serial = (
            fields["serial_number"]
            if "serial_number" in fields
            else row.serial_number
        )
        assert_charger_serial(effective_type, effective_serial)

        if "product_id" in fields and fields.get("product_id") is not None:
            self._validate_product(ctx, fields["product_id"])

        asset = self._assets.get(ctx, row.asset_id)
        if asset is None:
            raise NotFoundException("Asset not found")
        if asset.status in BLOCKED_ASSET_STATUSES:
            raise ComponentValidationError(
                "Components cannot be updated when the parent asset is disposed or written-off"
            )

    def validate_replace_readiness(self, ctx: TenantContext, row: AstAssetComponent) -> None:
        if row.status != AssetComponentStatus.ACTIVE.value:
            raise ComponentValidationError("Only active components can be replaced")
        if getattr(row, "component_asset_id", None) is not None:
            raise ComponentValidationError(
                "Asset-linked components cannot be replaced; detach or dispose instead"
            )
        asset = self._assets.get(ctx, row.asset_id)
        if asset is None:
            raise NotFoundException("Asset not found")
        if asset.status in BLOCKED_ASSET_STATUSES:
            raise ComponentValidationError(
                "Components cannot be replaced when the parent asset is disposed or written-off"
            )
        blocking = self._assignment_components.find_active_issue(ctx, component_id=row.id)
        if blocking:
            raise ComponentValidationError(
                "Cannot replace a component that is currently issued on an assignment"
            )

    def validate_dispose_readiness(self, ctx: TenantContext, row: AstAssetComponent) -> None:
        if row.status != AssetComponentStatus.ACTIVE.value:
            raise ComponentValidationError("Only active components can be disposed")
        blocking = self._assignment_components.find_active_issue(ctx, component_id=row.id)
        if blocking:
            raise ComponentValidationError(
                "Cannot dispose a component that is currently issued on an assignment"
            )

    def validate_successor_fields(
        self,
        ctx: TenantContext,
        *,
        company_id: UUID,
        source: AstAssetComponent,
        fields: dict,
    ) -> None:
        """Fields for the new active component created during replace."""
        fields.setdefault("asset_id", source.asset_id)
        fields.setdefault("component_code", source.component_code)
        if not fields.get("component_name"):
            fields["component_name"] = source.component_name
        fields.setdefault("component_type", getattr(source, "component_type", "OTHER"))
        fields.setdefault("branch_id", source.branch_id)
        fields.setdefault("product_id", source.product_id)
        if "quantity" not in fields:
            fields["quantity"] = source.quantity
        fields["_exclude_component_id"] = source.id
        self.validate_install_fields(ctx, company_id=company_id, fields=fields)
        fields.pop("_exclude_component_id", None)

    @staticmethod
    def _validate_quantity(quantity) -> Decimal:
        try:
            value = Decimal(str(quantity))
        except Exception as exc:
            raise ComponentValidationError("quantity must be a number") from exc
        if value < 0:
            raise ComponentValidationError("quantity cannot be negative")
        return value

    @staticmethod
    def _validate_serial(serial_number: str) -> str:
        value = str(serial_number).strip()
        if not value:
            raise ComponentValidationError("serial_number cannot be empty")
        if len(value) > 100:
            raise ComponentValidationError("serial_number exceeds maximum length")
        return value

    def _validate_product(self, ctx: TenantContext, product_id: UUID) -> None:
        try:
            self._master.get_product(ctx, product_id)
        except NotFoundException:
            raise
        except Exception as exc:
            raise ComponentValidationError("product_id is invalid") from exc
