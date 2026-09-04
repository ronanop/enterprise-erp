"""Asset Information Portal / Self-Service read composition (CR-002).

Read-only. Always loads the asset through AssetService.
Never exposes finance, workflow, or cost fields.
"""

from uuid import UUID

from sqlalchemy.orm import Session

from core.exceptions import NotFoundException
from modules.asset.adapters.master_data_port import AssetMasterDataAdapter
from modules.asset.domain.enums import AssetAssignmentStatus
from modules.asset.repository.asset_assignment_repository import (
    AssetAssignmentListFilters,
    AssetAssignmentRepository,
)
from modules.asset.repository.asset_category_repository import AssetCategoryRepository
from modules.asset.repository.asset_insurance_repository import AssetInsuranceRepository
from modules.asset.repository.asset_warranty_repository import AssetWarrantyRepository
from modules.asset.schemas import (
    AssetInformationPortalResponse,
    AssetPortalAssignmentSummary,
    AssetPortalInsuranceSummary,
    AssetPortalWarrantySummary,
)
from modules.asset.service.asset_service import AssetService
from modules.foundation.domain.value_objects import TenantContext


class AssetInformationPortalService:
    def __init__(self, db: Session) -> None:
        self._assets = AssetService(db)
        self._categories = AssetCategoryRepository(db)
        self._assignments = AssetAssignmentRepository(db)
        self._warranties = AssetWarrantyRepository(db)
        self._insurances = AssetInsuranceRepository(db)
        self._master = AssetMasterDataAdapter(db)

    def get_portal(self, ctx: TenantContext, asset_id: UUID) -> AssetInformationPortalResponse:
        """Build redacted portal/self-service profile for an authenticated caller."""
        asset = self._assets.get(ctx, asset_id)

        category_code = None
        category_name = None
        category = self._categories.get(ctx, asset.asset_category_id)
        if category is not None:
            category_code = category.category_code
            category_name = category.category_name

        manufacturer = self._safe_vendor_name(ctx, asset.supplier_vendor_id)
        model = self._safe_product_model(ctx, asset.product_id)

        return AssetInformationPortalResponse(
            asset_id=asset.id,
            asset_code=asset.asset_code,
            asset_name=asset.asset_name,
            category_code=category_code,
            category_name=category_name,
            manufacturer=manufacturer,
            model=model,
            serial_number=asset.serial_number,
            asset_type=asset.asset_type,
            status=asset.status,
            assignment=self._active_assignment(ctx, company_id=asset.company_id, asset_id=asset.id),
            warranty=self._warranty_summary(ctx, company_id=asset.company_id, asset_id=asset.id),
            insurance=self._insurance_summary(
                ctx, company_id=asset.company_id, asset_id=asset.id
            ),
            self_service_path=f"/assets/self-service/{asset.id}",
            discovery_profile_json=getattr(asset, "discovery_profile_json", None),
            version=int(asset.version or 1),
        )

    def get_self_service(
        self, ctx: TenantContext, asset_id: UUID
    ) -> AssetInformationPortalResponse:
        """Alias for portal profile — reserved for future signed-token entry."""
        return self.get_portal(ctx, asset_id)

    def _safe_vendor_name(self, ctx: TenantContext, vendor_id: UUID | None) -> str | None:
        if vendor_id is None:
            return None
        try:
            vendor = self._master.get_vendor(ctx, vendor_id)
        except NotFoundException:
            return None
        return getattr(vendor, "vendor_name", None)

    def _safe_product_model(self, ctx: TenantContext, product_id: UUID | None) -> str | None:
        if product_id is None:
            return None
        try:
            product = self._master.get_product(ctx, product_id)
        except NotFoundException:
            return None
        return getattr(product, "product_name", None) or getattr(product, "product_code", None)

    def _active_assignment(
        self, ctx: TenantContext, *, company_id: UUID, asset_id: UUID
    ) -> AssetPortalAssignmentSummary | None:
        rows, _ = self._assignments.search(
            ctx,
            AssetAssignmentListFilters(
                company_id=company_id,
                asset_id=asset_id,
                status=AssetAssignmentStatus.ACTIVE.value,
            ),
            offset=0,
            limit=1,
        )
        if not rows:
            return None
        row = rows[0]
        label = None
        if row.employee_id is not None:
            try:
                emp = self._master.get_employee(ctx, row.employee_id)
                label = f"{emp.employee_code} — {emp.first_name} {emp.last_name}".strip()
            except NotFoundException:
                label = None
        if label is None:
            label = row.allocation_type
        return AssetPortalAssignmentSummary(
            document_number=row.document_number,
            allocation_type=row.allocation_type,
            status=row.status,
            assignee_label=label,
        )

    def _warranty_summary(
        self, ctx: TenantContext, *, company_id: UUID, asset_id: UUID
    ) -> AssetPortalWarrantySummary | None:
        row = self._warranties.find_open_for_asset(
            ctx, company_id=company_id, asset_id=asset_id
        )
        if row is None:
            return None
        return AssetPortalWarrantySummary(
            warranty_type=row.warranty_type,
            status=row.status,
            start_date=row.start_date,
            end_date=row.end_date,
        )

    def _insurance_summary(
        self, ctx: TenantContext, *, company_id: UUID, asset_id: UUID
    ) -> AssetPortalInsuranceSummary | None:
        row = self._insurances.find_open_for_asset(
            ctx, company_id=company_id, asset_id=asset_id
        )
        if row is None:
            return None
        return AssetPortalInsuranceSummary(
            policy_number=row.policy_number,
            insurer_name=row.insurer_name,
            status=row.status,
            start_date=row.start_date,
            end_date=row.end_date,
        )
