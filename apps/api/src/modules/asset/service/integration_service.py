"""Asset integration service - cross-module reads / master create only."""

from uuid import UUID

from sqlalchemy.orm import Session

from modules.asset.adapters.master_data_port import AssetMasterDataAdapter
from modules.asset.adapters.organization_port import AssetOrganizationAdapter
from modules.asset.adapters.payroll_port import AssetPayrollAdapter
from modules.foundation.domain.value_objects import TenantContext


class AssetIntegrationService:
    def __init__(self, db: Session) -> None:
        self._master = AssetMasterDataAdapter(db)
        self._org = AssetOrganizationAdapter(db)
        self._payroll = AssetPayrollAdapter(db)

    def get_employee(self, ctx: TenantContext, employee_id: UUID):
        return self._master.get_employee(ctx, employee_id)

    def get_product(self, ctx: TenantContext, product_id: UUID):
        return self._master.get_product(ctx, product_id)

    def get_vendor(self, ctx: TenantContext, vendor_id: UUID):
        return self._master.get_vendor(ctx, vendor_id)

    def get_department(self, ctx: TenantContext, department_id: UUID):
        return self._org.get_department(ctx, department_id)

    def labor_cost_hint(self, ctx: TenantContext, employee_id: UUID):
        return self._payroll.labor_cost_hint(ctx, employee_id)
