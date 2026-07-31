"""Asset registration validation per FRD-12 and ADR-ASSET-REG-001."""

from datetime import date
from decimal import Decimal
from uuid import UUID

from sqlalchemy.orm import Session

from modules.asset.adapters.master_data_port import AssetMasterDataAdapter
from modules.asset.adapters.organization_port import AssetOrganizationAdapter
from modules.asset.adapters.procurement_read_port import ProcurementReadPort
from modules.asset.domain.enums import AssetCategoryStatus, AssetStatus
from modules.asset.domain.exceptions import (
    DuplicateAssetRegistrationError,
    RegistrationValidationError,
)
from modules.asset.models import AstAsset
from modules.asset.repository.asset_category_repository import AssetCategoryRepository
from modules.asset.repository.asset_repository import AssetRepository
from modules.foundation.domain.value_objects import TenantContext


class RegistrationValidator:
    ASSET_TYPES = frozenset({"fixed", "consumable", "digital", "leased"})

    def __init__(self, db: Session) -> None:
        self._assets = AssetRepository(db)
        self._categories = AssetCategoryRepository(db)
        self._master = AssetMasterDataAdapter(db)
        self._org = AssetOrganizationAdapter(db)
        self._procurement = ProcurementReadPort(db)

    def validate_create_fields(
        self,
        ctx: TenantContext,
        *,
        company_id: UUID,
        branch_id: UUID,
        fields: dict,
    ) -> None:
        if fields.get("asset_code"):
            raise RegistrationValidationError("asset_code is system-assigned and cannot be provided")
        if fields.get("status") and fields["status"] != AssetStatus.DRAFT.value:
            raise RegistrationValidationError("New registrations must start in draft status")
        self._validate_common(ctx, company_id=company_id, fields=fields, exclude_id=None)

    def validate_update_fields(
        self,
        ctx: TenantContext,
        row: AstAsset,
        fields: dict,
    ) -> None:
        if row.status != AssetStatus.DRAFT.value:
            raise RegistrationValidationError("Only draft registrations can be updated")
        if "asset_code" in fields or "document_number" in fields:
            raise RegistrationValidationError("Asset code cannot be changed")
        merged = {
            "asset_name": fields.get("asset_name", row.asset_name),
            "asset_category_id": fields.get("asset_category_id", row.asset_category_id),
            "asset_type": fields.get("asset_type", row.asset_type),
            "purchase_date": fields.get("purchase_date", row.purchase_date),
            "purchase_cost": fields.get("purchase_cost", row.purchase_cost),
            "currency_code": fields.get("currency_code", row.currency_code),
            "supplier_vendor_id": fields.get("supplier_vendor_id", row.supplier_vendor_id),
            "department_id": fields.get("department_id", row.department_id),
            "custodian_employee_id": fields.get("custodian_employee_id", row.custodian_employee_id),
            "serial_number": fields.get("serial_number", row.serial_number),
            "barcode": fields.get("barcode", row.barcode),
            "purchase_order_id": fields.get("purchase_order_id", row.purchase_order_id),
            "grn_id": fields.get("grn_id", row.grn_id),
        }
        self._validate_common(
            ctx,
            company_id=row.company_id,
            fields=merged,
            exclude_id=row.id,
            partial=True,
        )

    def validate_submit_readiness(self, ctx: TenantContext, row: AstAsset) -> None:
        if row.status != AssetStatus.DRAFT.value:
            raise RegistrationValidationError("Only draft registrations can be submitted")
        missing = []
        if not row.asset_name:
            missing.append("asset_name")
        if not row.asset_category_id:
            missing.append("asset_category_id")
        if not row.asset_type:
            missing.append("asset_type")
        if row.purchase_date is None:
            missing.append("purchase_date")
        if row.purchase_cost is None:
            missing.append("purchase_cost")
        if not row.currency_code:
            missing.append("currency_code")
        if missing:
            raise RegistrationValidationError(
                f"Submit readiness failed; missing mandatory fields: {', '.join(missing)}"
            )
        self._validate_common(
            ctx,
            company_id=row.company_id,
            fields={
                "asset_name": row.asset_name,
                "asset_category_id": row.asset_category_id,
                "asset_type": row.asset_type,
                "purchase_date": row.purchase_date,
                "purchase_cost": row.purchase_cost,
                "currency_code": row.currency_code,
                "supplier_vendor_id": row.supplier_vendor_id,
                "department_id": row.department_id,
                "custodian_employee_id": row.custodian_employee_id,
                "serial_number": row.serial_number,
                "barcode": row.barcode,
                "purchase_order_id": row.purchase_order_id,
                "grn_id": row.grn_id,
            },
            exclude_id=row.id,
            partial=False,
        )

    def _validate_common(
        self,
        ctx: TenantContext,
        *,
        company_id: UUID,
        fields: dict,
        exclude_id: UUID | None,
        partial: bool = False,
    ) -> None:
        asset_type = fields.get("asset_type")
        if asset_type is not None and asset_type not in self.ASSET_TYPES:
            raise RegistrationValidationError(f"Invalid asset_type '{asset_type}'")

        category_id = fields.get("asset_category_id")
        if category_id is not None:
            category = self._categories.get(ctx, category_id)
            if category is None:
                raise RegistrationValidationError("Asset category not found")
            if category.company_id != company_id:
                raise RegistrationValidationError("Asset category does not belong to this company")
            if category.status != AssetCategoryStatus.ACTIVE.value:
                raise RegistrationValidationError("Asset category is not active")

        vendor_id = fields.get("supplier_vendor_id")
        if vendor_id is not None:
            self._master.get_vendor(ctx, vendor_id)

        department_id = fields.get("department_id")
        if department_id is not None:
            self._org.get_department(ctx, department_id)

        custodian_id = fields.get("custodian_employee_id")
        if custodian_id is not None:
            self._master.get_employee(ctx, custodian_id)

        purchase_cost = fields.get("purchase_cost")
        if purchase_cost is not None and Decimal(str(purchase_cost)) < 0:
            raise RegistrationValidationError("purchase_cost cannot be negative")

        purchase_date = fields.get("purchase_date")
        if purchase_date is not None and purchase_date > date.today():
            raise RegistrationValidationError("purchase_date cannot be in the future")

        serial = fields.get("serial_number")
        if serial:
            existing = self._assets.find_by_serial(ctx, company_id, serial, exclude_id=exclude_id)
            if existing is not None:
                raise DuplicateAssetRegistrationError(
                    f"Serial number '{serial}' is already registered"
                )

        barcode = fields.get("barcode")
        if barcode:
            existing = self._assets.find_by_barcode(ctx, company_id, barcode, exclude_id=exclude_id)
            if existing is not None:
                raise DuplicateAssetRegistrationError(f"Barcode '{barcode}' is already registered")

        po_id = fields.get("purchase_order_id")
        if po_id is not None:
            self._procurement.validate_purchase_order(ctx, company_id, po_id)

        grn_id = fields.get("grn_id")
        if grn_id is not None:
            self._procurement.validate_grn(ctx, company_id, grn_id)
            if po_id is not None:
                grn = self._procurement.get_grn(ctx, grn_id)
                if grn.order_header_id != po_id:
                    raise RegistrationValidationError(
                        "GRN is not linked to the specified purchase order"
                    )

        if not partial:
            for name in (
                "asset_name",
                "asset_category_id",
                "asset_type",
                "purchase_date",
                "purchase_cost",
                "currency_code",
            ):
                if fields.get(name) in (None, ""):
                    raise RegistrationValidationError(f"{name} is required")
