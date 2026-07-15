"""GRC integration — cross-module reads / UUID stubs; no peer ORM writes."""

from uuid import UUID

from sqlalchemy.orm import Session

from modules.foundation.domain.value_objects import TenantContext
from modules.grc.adapters.document_port import GrcDocumentAdapter
from modules.grc.adapters.helpdesk_port import GrcHelpdeskAdapter
from modules.grc.adapters.master_data_port import GrcMasterDataAdapter
from modules.grc.adapters.organization_port import GrcOrganizationAdapter
from modules.grc.adapters.payroll_port import GrcPayrollAdapter


class GrcIntegrationService:
    def __init__(self, db: Session) -> None:
        self._master = GrcMasterDataAdapter(db)
        self._org = GrcOrganizationAdapter(db)
        self._payroll = GrcPayrollAdapter(db)
        self._document = GrcDocumentAdapter()
        self._helpdesk = GrcHelpdeskAdapter()

    def get_employee(self, ctx: TenantContext, employee_id: UUID):
        return self._master.get_employee(ctx, employee_id)

    def get_customer(self, ctx: TenantContext, customer_id: UUID):
        return self._master.get_customer(ctx, customer_id)

    def get_department(self, ctx: TenantContext, department_id: UUID):
        return self._org.get_department(ctx, department_id)

    def resolve_document(self, document_id: UUID | None) -> UUID | None:
        return self._document.resolve_document_uuid(document_id)

    def resolve_helpdesk_ticket(self, helpdesk_ticket_id: UUID | None) -> UUID | None:
        return self._helpdesk.resolve_ticket_uuid(helpdesk_ticket_id)

    def labor_cost_hint(self, ctx: TenantContext, employee_id: UUID) -> None:
        return self._payroll.labor_cost_hint(ctx, employee_id)
