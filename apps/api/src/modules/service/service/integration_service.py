"""Service integration — cross-module reads only; no peer ORM writes."""

from uuid import UUID

from sqlalchemy.orm import Session

from modules.foundation.domain.value_objects import TenantContext
from modules.service.adapters.asset_port import ServiceAssetAdapter
from modules.service.adapters.master_data_port import ServiceMasterDataAdapter
from modules.service.adapters.organization_port import ServiceOrganizationAdapter
from modules.service.adapters.payroll_port import ServicePayrollAdapter


class ServiceIntegrationService:
    def __init__(self, db: Session) -> None:
        self._master = ServiceMasterDataAdapter(db)
        self._org = ServiceOrganizationAdapter(db)
        self._payroll = ServicePayrollAdapter(db)
        self._asset = ServiceAssetAdapter(db)

    def get_customer(self, ctx: TenantContext, customer_id: UUID):
        return self._master.get_customer(ctx, customer_id)

    def get_employee(self, ctx: TenantContext, employee_id: UUID):
        return self._master.get_employee(ctx, employee_id)

    def get_product(self, ctx: TenantContext, product_id: UUID):
        return self._master.get_product(ctx, product_id)

    def get_master_asset(self, ctx: TenantContext, master_asset_id: UUID):
        return self._master.get_asset(ctx, master_asset_id)

    def get_department(self, ctx: TenantContext, department_id: UUID):
        return self._org.get_department(ctx, department_id)

    def labor_cost_hint(self, ctx: TenantContext, employee_id: UUID):
        return self._payroll.labor_cost_hint(ctx, employee_id)

    def resolve_operational_asset(self, asset_id: UUID | None):
        return self._asset.resolve_asset_uuid(asset_id)
