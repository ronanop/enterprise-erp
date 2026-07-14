"""Sales port — CRM never writes sales_* tables."""

from datetime import date, timedelta
from uuid import UUID

from sqlalchemy.orm import Session

from modules.foundation.domain.value_objects import TenantContext
from modules.sales.service.customer_credit_service import CustomerCreditService
from modules.sales.service.quotation_service import QuotationService


class CrmSalesAdapter:
    def __init__(self, db: Session) -> None:
        self._quotations = QuotationService(db)
        self._credits = CustomerCreditService(db)

    def create_quotation_for_opportunity(
        self,
        ctx: TenantContext,
        *,
        company_id: UUID,
        branch_id: UUID,
        customer_id: UUID,
        opportunity_id: UUID,
        currency_code: str = "USD",
    ):
        today = date.today()
        return self._quotations.create(
            ctx,
            company_id=company_id,
            branch_id=branch_id,
            document_date=today,
            valid_until=today + timedelta(days=30),
            customer_id=customer_id,
            currency_code=currency_code,
            opportunity_reference=opportunity_id,
        )

    def read_customer_credit(self, ctx: TenantContext, company_id: UUID, customer_id: UUID):
        credits = self._credits.list_credits(ctx, company_id)
        for row in credits:
            if row.customer_id == customer_id:
                return row
        return None
