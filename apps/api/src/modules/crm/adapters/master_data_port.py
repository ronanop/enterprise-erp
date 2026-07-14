"""Master Data port — CRM never writes master_* except via CustomerService."""

from uuid import UUID

from sqlalchemy.orm import Session

from modules.foundation.domain.value_objects import TenantContext
from modules.master_data.service.customer_service import CustomerService


class CrmMasterDataAdapter:
    def __init__(self, db: Session) -> None:
        self._customers = CustomerService(db)

    def get_customer(self, ctx: TenantContext, customer_id: UUID):
        return self._customers.get_customer(ctx, customer_id)

    def create_customer_from_lead(
        self,
        ctx: TenantContext,
        *,
        company_id: UUID,
        branch_id: UUID,
        customer_name: str,
        email: str | None,
        mobile: str | None,
    ):
        return self._customers.create_customer(
            ctx,
            company_id=company_id,
            branch_id=branch_id,
            customer_name=customer_name,
            customer_type="corporate",
            billing_address_json={},
            email=email,
            mobile=mobile,
        )
