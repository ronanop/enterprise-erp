"""Asset component validation rules for FP-ASSET-019."""

from __future__ import annotations

from decimal import Decimal
from uuid import UUID

from sqlalchemy.orm import Session

from core.exceptions import NotFoundException
from modules.asset.adapters.master_data_port import AssetMasterDataAdapter
from modules.asset.domain.enums import AssetComponentStatus, AssetStatus
from modules.asset.domain.exceptions import ComponentValidationError
from modules.asset.models import AstAssetComponent
from modules.asset.repository.asset_component_repository import AssetComponentRepository
from modules.asset.repository.asset_repository import AssetRepository
from modules.foundation.domain.value_objects import TenantContext

BLOCKED_ASSET_STATUSES = frozenset(
    {
        AssetStatus.DISPOSED.value,
        AssetStatus.WRITTEN_OFF.value,
    }
)
IMMUTABLE_AFTER_INSTALL = frozenset({"asset_id", "component_code"})


class ComponentValidator:
    def __init__(self, db: Session) -> None:
        self._assets = AssetRepository(db)
        self._components = AssetComponentRepository(db)
        self._master = AssetMasterDataAdapter(db)

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

        code = fields.get("component_code")
        if not code or not str(code).strip():
            raise ComponentValidationError("component_code is required")
        fields["component_code"] = str(code).strip()
        if len(fields["component_code"]) > 50:
            raise ComponentValidationError("component_code exceeds maximum length")

        name = fields.get("component_name")
        if not name or not str(name).strip():
            raise ComponentValidationError("component_name is required")
        fields["component_name"] = str(name).strip()

        if "quantity" in fields and fields.get("quantity") is not None:
            fields["quantity"] = self._validate_quantity(fields["quantity"])

        if "serial_number" in fields and fields.get("serial_number") is not None:
            fields["serial_number"] = self._validate_serial(fields["serial_number"])

        asset = self._assets.get(ctx, asset_id)
        if asset is None:
            raise NotFoundException("Asset not found")
        if asset.company_id != company_id:
            raise ComponentValidationError("Asset does not belong to this company")
        if asset.status in BLOCKED_ASSET_STATUSES:
            raise ComponentValidationError(
                "Components cannot be installed on disposed or written-off assets"
            )

        if self._components.find_active_by_code(
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
        asset = self._assets.get(ctx, row.asset_id)
        if asset is None:
            raise NotFoundException("Asset not found")
        if asset.status in BLOCKED_ASSET_STATUSES:
            raise ComponentValidationError(
                "Components cannot be replaced when the parent asset is disposed or written-off"
            )

    def validate_dispose_readiness(self, ctx: TenantContext, row: AstAssetComponent) -> None:
        if row.status != AssetComponentStatus.ACTIVE.value:
            raise ComponentValidationError("Only active components can be disposed")

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
