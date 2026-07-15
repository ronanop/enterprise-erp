"""HelpdeskReportService."""

from uuid import UUID

from sqlalchemy.orm import Session

from core.exceptions import NotFoundException
from modules.foundation.domain.value_objects import TenantContext
from modules.foundation.service.audit_service import AuditService
from modules.helpdesk.domain.enums import HdEntityType
from modules.helpdesk.models import HdTicketReport
from modules.helpdesk.repository.ticket_report_repository import TicketReportRepository
from modules.helpdesk.service.document_number_service import DocumentNumberService
from modules.helpdesk.service.engines import TicketReportEngine
from modules.helpdesk.service.helpdesk_scope_validator import HelpdeskScopeValidator


class HelpdeskReportService:
    def __init__(self, db: Session) -> None:
        self._repo = TicketReportRepository(db)
        self._scope = HelpdeskScopeValidator(db)
        self._numbers = DocumentNumberService(db)
        self._engine = TicketReportEngine()
        self._audit = AuditService(db)

    def list(self, ctx: TenantContext, company_id: UUID | None = None):
        cid = self._scope.resolve_company_id(ctx, company_id)
        return self._repo.list_rows(ctx, cid)

    def get(self, ctx: TenantContext, row_id: UUID) -> HdTicketReport:
        row = self._repo.get(ctx, row_id)
        if row is None:
            raise NotFoundException("HelpdeskReportService not found")
        return row

    def create(self, ctx: TenantContext, company_id: UUID | None = None, **fields):
        cid = self._scope.resolve_company_id(ctx, company_id)
        doc = self._numbers.generate(HdEntityType.REPORT, cid, HdTicketReport, "report_code")
        return self._repo.create(ctx, company_id=cid, report_code=doc, **fields)

    def update(self, ctx: TenantContext, row_id: UUID, **fields):
        self.get(ctx, row_id)
        row = self._repo.update(ctx, row_id, **fields)
        if row is None:
            raise NotFoundException("HelpdeskReportService not found")
        return row

    def finalize(self, ctx: TenantContext, row_id: UUID):
        row = self.get(ctx, row_id)
        self._engine.finalize(row)
        return self._repo.update(ctx, row_id, status=row.status)
