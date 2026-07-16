"""Customer Portal integration service using peer adapters (C-01 + UUID refs)."""

from decimal import Decimal
from uuid import UUID

from sqlalchemy.orm import Session

from modules.foundation.domain.value_objects import TenantContext
from modules.portal.adapters.analytics_port import PortalAnalyticsAdapter
from modules.portal.adapters.crm_port import PortalCrmAdapter
from modules.portal.adapters.document_port import PortalDocumentAdapter
from modules.portal.adapters.ecommerce_port import PortalEcommerceAdapter
from modules.portal.adapters.finance_port import PortalFinanceAdapter
from modules.portal.adapters.helpdesk_port import PortalHelpdeskAdapter
from modules.portal.adapters.integration_port import PortalIntegrationAdapter
from modules.portal.adapters.master_data_port import PortalMasterDataAdapter
from modules.portal.adapters.organization_port import PortalOrganizationAdapter
from modules.portal.adapters.sales_port import PortalSalesAdapter
from modules.portal.adapters.service_port import PortalServiceAdapter
from modules.portal.models import PtInvoiceView


class PortalIntegrationService:
    def __init__(self, db: Session) -> None:
        self._master = PortalMasterDataAdapter(db)
        self._org = PortalOrganizationAdapter(db)
        self._crm = PortalCrmAdapter(db)
        self._sales = PortalSalesAdapter(db)
        self._finance = PortalFinanceAdapter(db)
        self._document = PortalDocumentAdapter(db)
        self._helpdesk = PortalHelpdeskAdapter(db)
        self._service = PortalServiceAdapter(db)
        self._analytics = PortalAnalyticsAdapter(db)
        self._integration = PortalIntegrationAdapter(db)
        self._ecommerce = PortalEcommerceAdapter(db)

    def get_employee(self, ctx: TenantContext, employee_id: UUID):
        return self._master.get_employee(ctx, employee_id)

    def get_customer(self, ctx: TenantContext, customer_id: UUID):
        return self._master.get_customer(ctx, customer_id)

    def get_product(self, ctx: TenantContext, product_id: UUID):
        return self._master.get_product(ctx, product_id)

    def get_department(self, ctx: TenantContext, department_id: UUID):
        return self._org.get_department(ctx, department_id)

    def crm_party_ref(self, ctx: TenantContext, crm_party_ref_id: UUID | None) -> UUID | None:
        return self._crm.resolve_party_ref(ctx, crm_party_ref_id)

    def sales_order_ref(self, ctx: TenantContext, sales_order_id: UUID | None) -> UUID | None:
        return self._sales.resolve_sales_order_ref(ctx, sales_order_id)

    def finance_invoice_ref(self, ctx: TenantContext, finance_invoice_id: UUID | None) -> UUID | None:
        return self._finance.resolve_invoice_ref(ctx, finance_invoice_id)

    def document_ref(self, ctx: TenantContext, document_id: UUID | None) -> UUID | None:
        return self._document.resolve_document_uuid(document_id)

    def helpdesk_ticket_ref(self, ctx: TenantContext, helpdesk_ticket_id: UUID | None) -> UUID | None:
        return self._helpdesk.resolve_ticket_ref(ctx, helpdesk_ticket_id)

    def service_request_ref(self, ctx: TenantContext, service_request_id: UUID | None) -> UUID | None:
        return self._service.resolve_request_ref(ctx, service_request_id)

    def analytics_report_ref(self, ctx: TenantContext, bi_report_ref_id: UUID | None) -> UUID | None:
        return self._analytics.resolve_report_ref(ctx, bi_report_ref_id)

    def integration_connector_ref(self, ctx: TenantContext, int_connector_id: UUID | None) -> UUID | None:
        return self._integration.resolve_connector_ref(ctx, int_connector_id)

    def ecommerce_order_ref(self, ctx: TenantContext, ec_order_id: UUID | None) -> UUID | None:
        return self._ecommerce.resolve_order_ref(ctx, ec_order_id)

    def post_portal_fee(
        self,
        ctx: TenantContext,
        row: PtInvoiceView,
        *,
        amount: Decimal,
        debit_account_id: UUID,
        credit_account_id: UUID,
        fiscal_year_id: UUID | None = None,
    ) -> UUID:
        return self._finance.post_portal_fee(
            ctx,
            row,
            amount=amount,
            debit_account_id=debit_account_id,
            credit_account_id=credit_account_id,
            fiscal_year_id=fiscal_year_id,
        )
