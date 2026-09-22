"""Integration Hub peer port - C-01 masters + org; Finance event-ref ONLY.

NEVER uses PostingService. NEVER writes fin_* or peer operational tables.
Peers communicate via events / REST / webhooks / UUID only.
"""

from uuid import UUID

from sqlalchemy.orm import Session

from modules.foundation.domain.value_objects import TenantContext
from modules.integration.adapters.finance_event_port import IntegrationFinanceEventAdapter
from modules.integration.adapters.master_data_port import IntegrationMasterDataAdapter
from modules.integration.adapters.organization_port import IntegrationOrganizationAdapter


class IntegrationIntegrationService:
    def __init__(self, db: Session) -> None:
        self._master = IntegrationMasterDataAdapter(db)
        self._org = IntegrationOrganizationAdapter(db)
        self._finance = IntegrationFinanceEventAdapter(db)

    def get_employee(self, ctx: TenantContext, employee_id: UUID):
        return self._master.get_employee(ctx, employee_id)

    def get_customer(self, ctx: TenantContext, customer_id: UUID):
        return self._master.get_customer(ctx, customer_id)

    def get_product(self, ctx: TenantContext, product_id: UUID):
        return self._master.get_product(ctx, product_id)

    def get_vendor(self, ctx: TenantContext, vendor_id: UUID):
        return self._master.get_vendor(ctx, vendor_id)

    def get_department(self, ctx: TenantContext, department_id: UUID):
        return self._org.get_department(ctx, department_id)

    def finance_event_ref(self, ctx: TenantContext, finance_event_ref_id: UUID | None) -> UUID | None:
        return self._finance.resolve_event_ref(ctx, finance_event_ref_id)
