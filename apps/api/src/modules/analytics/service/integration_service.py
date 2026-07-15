"""Analytics integration — read-only peers; no PostingService / no fin_* writes."""

from uuid import UUID

from sqlalchemy.orm import Session

from modules.analytics.adapters.finance_read_port import AnalyticsFinanceReadAdapter
from modules.analytics.adapters.master_data_port import AnalyticsMasterDataAdapter
from modules.analytics.adapters.organization_port import AnalyticsOrganizationAdapter
from modules.foundation.domain.value_objects import TenantContext


class AnalyticsIntegrationService:
    def __init__(self, db: Session) -> None:
        self._master = AnalyticsMasterDataAdapter(db)
        self._org = AnalyticsOrganizationAdapter(db)
        self._finance = AnalyticsFinanceReadAdapter(db)

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

    def finance_ledger_hint(self, ctx: TenantContext, ledger_ref_id: UUID | None) -> UUID | None:
        return self._finance.resolve_ledger_ref(ctx, ledger_ref_id)
