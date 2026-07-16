"""Master Data port — customer / employee / product (C-01)."""

from uuid import UUID

from sqlalchemy.orm import Session

from modules.foundation.domain.value_objects import TenantContext
from modules.master_data.service.customer_service import CustomerService
from modules.master_data.service.employee_service import EmployeeService
from modules.master_data.service.product_service import ProductService


class PortalMasterDataAdapter:
    def __init__(self, db: Session) -> None:
        self._customers = CustomerService(db)
        self._employees = EmployeeService(db)
        self._products = ProductService(db)

    def get_customer(self, ctx: TenantContext, customer_id: UUID):
        return self._customers.get_customer(ctx, customer_id)

    def get_employee(self, ctx: TenantContext, employee_id: UUID):
        return self._employees.get_employee(ctx, employee_id)

    def get_product(self, ctx: TenantContext, product_id: UUID):
        return self._products.get_product(ctx, product_id)
