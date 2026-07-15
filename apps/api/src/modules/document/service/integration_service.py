"""Document integration — cross-module reads / UUID stubs; no peer ORM writes."""

from uuid import UUID

from sqlalchemy.orm import Session

from modules.document.adapters.helpdesk_port import DocumentHelpdeskAdapter
from modules.document.adapters.master_data_port import DocumentMasterDataAdapter
from modules.document.adapters.organization_port import DocumentOrganizationAdapter
from modules.document.adapters.payroll_port import DocumentPayrollAdapter
from modules.document.adapters.service_port import DocumentServiceAdapter
from modules.foundation.domain.value_objects import TenantContext


class DocumentIntegrationService:
    def __init__(self, db: Session) -> None:
        self._master = DocumentMasterDataAdapter(db)
        self._org = DocumentOrganizationAdapter(db)
        self._payroll = DocumentPayrollAdapter(db)
        self._service = DocumentServiceAdapter()
        self._helpdesk = DocumentHelpdeskAdapter()

    def get_employee(self, ctx: TenantContext, employee_id: UUID):
        return self._master.get_employee(ctx, employee_id)

    def get_customer(self, ctx: TenantContext, customer_id: UUID):
        return self._master.get_customer(ctx, customer_id)

    def get_department(self, ctx: TenantContext, department_id: UUID):
        return self._org.get_department(ctx, department_id)

    def resolve_service_request(self, service_request_id: UUID | None) -> UUID | None:
        return self._service.resolve_service_request_uuid(service_request_id)

    def resolve_helpdesk_ticket(self, helpdesk_ticket_id: UUID | None) -> UUID | None:
        return self._helpdesk.resolve_ticket_uuid(helpdesk_ticket_id)

    def labor_cost_hint(self, ctx: TenantContext, employee_id: UUID) -> None:
        return self._payroll.labor_cost_hint(ctx, employee_id)
