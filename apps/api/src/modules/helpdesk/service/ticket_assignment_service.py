"""TicketAssignmentService."""

from uuid import UUID

from sqlalchemy.orm import Session

from core.exceptions import NotFoundException
from modules.foundation.domain.value_objects import TenantContext
from modules.foundation.service.audit_service import AuditService
from modules.helpdesk.domain.enums import HdEntityType
from modules.helpdesk.models import HdTicketAssignment
from modules.helpdesk.repository.ticket_assignment_repository import TicketAssignmentRepository
from modules.helpdesk.service.document_number_service import DocumentNumberService
from modules.helpdesk.service.engines import TicketAssignmentEngine
from modules.helpdesk.service.helpdesk_scope_validator import HelpdeskScopeValidator


class TicketAssignmentService:
    def __init__(self, db: Session) -> None:
        self._repo = TicketAssignmentRepository(db)
        self._scope = HelpdeskScopeValidator(db)
        self._numbers = DocumentNumberService(db)
        self._engine = TicketAssignmentEngine()
        self._audit = AuditService(db)

    def list(self, ctx: TenantContext, company_id: UUID | None = None):
        cid = self._scope.resolve_company_id(ctx, company_id)
        return self._repo.list_rows(ctx, cid)

    def get(self, ctx: TenantContext, row_id: UUID) -> HdTicketAssignment:
        row = self._repo.get(ctx, row_id)
        if row is None:
            raise NotFoundException("TicketAssignmentService not found")
        return row

    def create(
        self, ctx: TenantContext, *, branch_id: UUID, company_id: UUID | None = None, **fields
    ):
        cid = self._scope.resolve_company_id(ctx, company_id)
        self._scope.validate_branch_access(ctx, branch_id)
        doc = self._numbers.generate(
            HdEntityType.ASSIGNMENT, cid, HdTicketAssignment, "document_number"
        )
        return self._repo.create(
            ctx, company_id=cid, branch_id=branch_id, document_number=doc, **fields
        )

    def update(self, ctx: TenantContext, row_id: UUID, **fields):
        self.get(ctx, row_id)
        row = self._repo.update(ctx, row_id, **fields)
        if row is None:
            raise NotFoundException("TicketAssignmentService not found")
        return row

    def submit(self, ctx: TenantContext, row_id: UUID):
        row = self.get(ctx, row_id)
        self._engine.submit(row)
        return self._repo.update(ctx, row_id, status=row.status)

    def approve(self, ctx: TenantContext, row_id: UUID):
        row = self.get(ctx, row_id)
        self._engine.approve(row)
        return self._repo.update(ctx, row_id, status=row.status)

    def complete(self, ctx: TenantContext, row_id: UUID):
        row = self.get(ctx, row_id)
        self._engine.complete(row)
        return self._repo.update(ctx, row_id, status=row.status)
