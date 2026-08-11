"""Master Data port â€” read employee / customer / product (C-01)."""

from uuid import UUID

from sqlalchemy.orm import Session

from modules.foundation.domain.value_objects import TenantContext
from modules.master_data.service.customer_service import CustomerService
from modules.master_data.service.employee_service import EmployeeService
from modules.master_data.service.product_service import ProductService


class ProjectMasterDataAdapter:
    def __init__(self, db: Session) -> None:
        self._employees = EmployeeService(db)
        self._customers = CustomerService(db)
        self._products = ProductService(db)

    def get_employee(self, ctx: TenantContext, employee_id: UUID):
        return self._employees.get_employee(ctx, employee_id)

    def list_employees(
        self,
        ctx: TenantContext,
        *,
        company_id: UUID | None = None,
        branch_id: UUID | None = None,
    ):
        return self._employees.list_employees(
            ctx, company_id=company_id, branch_id=branch_id
        )

    def get_customer(self, ctx: TenantContext, customer_id: UUID):
        return self._customers.get_customer(ctx, customer_id)

    def list_customers(self, ctx: TenantContext, *, company_id: UUID | None = None):
        return self._customers.list_customers(ctx, company_id=company_id)

    def get_product(self, ctx: TenantContext, product_id: UUID):
        return self._products.get_product(ctx, product_id)
