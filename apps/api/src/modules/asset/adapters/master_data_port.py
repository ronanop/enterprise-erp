"""Master Data port — AssetService for master_asset create/link + employee/product/vendor."""

from uuid import UUID

from sqlalchemy.orm import Session

from modules.asset.models import AstAsset
from modules.asset.repository.asset_category_repository import AssetCategoryRepository
from modules.foundation.domain.value_objects import TenantContext
from modules.master_data.service.asset_service import AssetService as MasterAssetService
from modules.master_data.service.employee_service import EmployeeService
from modules.master_data.service.product_service import ProductService
from modules.master_data.service.vendor_service import VendorService


class AssetMasterDataAdapter:
    def __init__(self, db: Session) -> None:
        self._assets = MasterAssetService(db)
        self._employees = EmployeeService(db)
        self._products = ProductService(db)
        self._vendors = VendorService(db)
        self._categories = AssetCategoryRepository(db)

    def get_employee(self, ctx: TenantContext, employee_id: UUID):
        return self._employees.get_employee(ctx, employee_id)

    def get_product(self, ctx: TenantContext, product_id: UUID):
        return self._products.get_product(ctx, product_id)

    def get_vendor(self, ctx: TenantContext, vendor_id: UUID):
        return self._vendors.get_vendor(ctx, vendor_id)

    def _resolve_master_category(self, ctx: TenantContext, asset: AstAsset) -> str:
        category = self._categories.get(ctx, asset.asset_category_id)
        if category is not None:
            return category.category_code or category.category_name
        return asset.asset_type

    def create_or_link_master_asset(self, ctx: TenantContext, asset: AstAsset):
        if asset.master_asset_id is not None:
            return self._assets.get_asset(ctx, asset.master_asset_id)
        master_category = self._resolve_master_category(ctx, asset)
        return self._assets.create_asset(
            ctx,
            company_id=asset.company_id,
            branch_id=asset.branch_id,
            asset_code=asset.asset_code,
            asset_name=asset.asset_name,
            asset_category=master_category,
            serial_number=asset.serial_number,
            purchase_date=asset.purchase_date,
            purchase_value=float(asset.purchase_cost) if asset.purchase_cost is not None else None,
            custodian_employee_id=asset.custodian_employee_id,
        )

    def mark_master_disposed(self, ctx: TenantContext, master_asset_id: UUID):
        return self._assets.update_asset(ctx, master_asset_id, status="disposed")

    def update_master_asset_transfer(self, ctx: TenantContext, master_asset_id: UUID, **fields):
        payload = {}
        if "branch_id" in fields:
            payload["branch_id"] = fields["branch_id"]
        if "custodian_employee_id" in fields:
            payload["custodian_employee_id"] = fields["custodian_employee_id"]
        if "location_id" in fields:
            payload["location_id"] = fields["location_id"]
        if not payload:
            return self._assets.get_asset(ctx, master_asset_id)
        return self._assets.update_asset(ctx, master_asset_id, **payload)
