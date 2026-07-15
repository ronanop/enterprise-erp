"""Helpdesk integration — cross-module reads / UUID stubs; no peer ORM writes."""

from uuid import UUID

from sqlalchemy.orm import Session

from modules.foundation.domain.value_objects import TenantContext
from modules.helpdesk.adapters.master_data_port import HelpdeskMasterDataAdapter
from modules.helpdesk.adapters.organization_port import HelpdeskOrganizationAdapter
from modules.helpdesk.adapters.payroll_port import HelpdeskPayrollAdapter
from modules.helpdesk.adapters.service_port import HelpdeskServiceAdapter


class HelpdeskIntegrationService:
    def __init__(self, db: Session) -> None:
        self._master = HelpdeskMasterDataAdapter(db)
        self._org = HelpdeskOrganizationAdapter(db)
        self._payroll = HelpdeskPayrollAdapter(db)
        self._service = HelpdeskServiceAdapter()

    def get_customer(self, ctx: TenantContext, customer_id: UUID):
        return self._master.get_customer(ctx, customer_id)

    def get_employee(self, ctx: TenantContext, employee_id: UUID):
        return self._master.get_employee(ctx, employee_id)

    def get_department(self, ctx: TenantContext, department_id: UUID):
        return self._org.get_department(ctx, department_id)

    def labor_cost_hint(self, ctx: TenantContext, employee_id: UUID):
        return self._payroll.labor_cost_hint(ctx, employee_id)

    def resolve_service_request(self, service_request_id: UUID | None):
        return self._service.resolve_service_request_uuid(service_request_id)

    def resolve_service_ticket(self, service_ticket_id: UUID | None):
        return self._service.resolve_service_ticket_uuid(service_ticket_id)

    def resolve_work_order(self, work_order_id: UUID | None):
        return self._service.resolve_work_order_uuid(work_order_id)
