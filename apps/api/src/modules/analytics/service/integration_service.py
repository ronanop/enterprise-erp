"""Analytics integration — read-only peers; no PostingService / no fin_* writes."""

from uuid import UUID

from sqlalchemy.orm import Session

from modules.analytics.adapters.finance_read_port import AnalyticsFinanceReadAdapter
from modules.analytics.adapters.helpdesk_read_port import AnalyticsHelpdeskReadAdapter
from modules.analytics.adapters.inventory_read_port import AnalyticsInventoryReadAdapter
from modules.analytics.adapters.manufacturing_read_port import AnalyticsManufacturingReadAdapter
from modules.analytics.adapters.master_data_port import AnalyticsMasterDataAdapter
from modules.analytics.adapters.organization_port import AnalyticsOrganizationAdapter
from modules.analytics.adapters.quality_read_port import AnalyticsQualityReadAdapter
from modules.analytics.adapters.sales_read_port import AnalyticsSalesReadAdapter
from modules.foundation.domain.value_objects import TenantContext


class AnalyticsIntegrationService:
    def __init__(self, db: Session) -> None:
        self._master = AnalyticsMasterDataAdapter(db)
        self._org = AnalyticsOrganizationAdapter(db)
        self._finance = AnalyticsFinanceReadAdapter(db)
        self._sales = AnalyticsSalesReadAdapter(db)
        self._inventory = AnalyticsInventoryReadAdapter(db)
        self._manufacturing = AnalyticsManufacturingReadAdapter(db)
        self._quality = AnalyticsQualityReadAdapter(db)
        self._helpdesk = AnalyticsHelpdeskReadAdapter(db)

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

    def headcount_by_department(self, ctx: TenantContext, company_id: UUID):
        return self._org.headcount_by_department(ctx, company_id)

    def count_active_customers(self, ctx: TenantContext, company_id: UUID) -> int:
        return self._master.count_active_customers(ctx, company_id)

    def count_active_vendors(self, ctx: TenantContext, company_id: UUID) -> int:
        return self._master.count_active_vendors(ctx, company_id)

    def get_total_revenue(self, ctx: TenantContext, company_id: UUID):
        return self._finance.get_total_revenue(ctx, company_id)

    def get_cash_position(self, ctx: TenantContext, company_id: UUID):
        return self._finance.get_cash_position(ctx, company_id)

    def get_ar_aging(self, ctx: TenantContext, company_id: UUID):
        return self._finance.get_ar_aging(ctx, company_id)

    def get_ap_aging(self, ctx: TenantContext, company_id: UUID):
        return self._finance.get_ap_aging(ctx, company_id)

    def sales_invoice_count(self, ctx: TenantContext, company_id: UUID):
        return self._sales.invoice_count(ctx, company_id)

    def sales_order_count(self, ctx: TenantContext, company_id: UUID):
        return self._sales.order_count(ctx, company_id)

    def sales_invoiced_total(self, ctx: TenantContext, company_id: UUID):
        return self._sales.invoiced_total(ctx, company_id)

    def inventory_on_hand_qty(self, ctx: TenantContext, company_id: UUID):
        return self._inventory.on_hand_qty(ctx, company_id)

    def inventory_available_qty(self, ctx: TenantContext, company_id: UUID):
        return self._inventory.available_qty(ctx, company_id)

    def inventory_balance_rows(self, ctx: TenantContext, company_id: UUID):
        return self._inventory.balance_row_count(ctx, company_id)

    def mfg_production_order_count(self, ctx: TenantContext, company_id: UUID):
        return self._manufacturing.production_order_count(ctx, company_id)

    def mfg_planned_qty(self, ctx: TenantContext, company_id: UUID):
        return self._manufacturing.planned_qty(ctx, company_id)

    def mfg_scrap_count(self, ctx: TenantContext, company_id: UUID):
        return self._manufacturing.scrap_count(ctx, company_id)

    def quality_ncr_count(self, ctx: TenantContext, company_id: UUID):
        return self._quality.ncr_count(ctx, company_id)

    def quality_ncr_open_count(self, ctx: TenantContext, company_id: UUID):
        return self._quality.ncr_open_count(ctx, company_id)

    def quality_incoming_inspection_count(self, ctx: TenantContext, company_id: UUID):
        return self._quality.incoming_inspection_count(ctx, company_id)

    def helpdesk_ticket_count(self, ctx: TenantContext, company_id: UUID):
        return self._helpdesk.ticket_count(ctx, company_id)

    def helpdesk_open_ticket_count(self, ctx: TenantContext, company_id: UUID):
        return self._helpdesk.open_ticket_count(ctx, company_id)

    def helpdesk_incident_count(self, ctx: TenantContext, company_id: UUID):
        return self._helpdesk.incident_count(ctx, company_id)
