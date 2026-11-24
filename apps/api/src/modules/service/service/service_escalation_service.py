"""ServiceEscalationService."""

from uuid import UUID

from sqlalchemy.orm import Session

from core.exceptions import NotFoundException
from modules.foundation.domain.value_objects import TenantContext
from modules.foundation.service.audit_service import AuditService
from modules.service.domain.enums import SvcEntityType
from modules.service.models import SvcServiceEscalation
from modules.service.repository.service_escalation_repository import ServiceEscalationRepository
from modules.service.service.document_number_service import DocumentNumberService
from modules.service.service.engines import ServiceEscalationEngine
from modules.service.service.service_scope_validator import ServiceScopeValidator


class ServiceEscalationService:
    def __init__(self, db: Session) -> None:
        self._repo = ServiceEscalationRepository(db)
        self._scope = ServiceScopeValidator(db)
        self._numbers = DocumentNumberService(db)
        self._engine = ServiceEscalationEngine()
        self._audit = AuditService(db)

    def list(self, ctx: TenantContext, company_id: UUID | None = None):
        cid = self._scope.resolve_company_id(ctx, company_id)
        return self._repo.list_rows(ctx, cid)

    def get(self, ctx: TenantContext, row_id: UUID) -> SvcServiceEscalation:
        row = self._repo.get(ctx, row_id)
        if row is None:
            raise NotFoundException("ServiceEscalationService not found")
        return row

    def create(self, ctx: TenantContext, *, branch_id: UUID, company_id: UUID | None = None, **fields):

        cid = self._scope.resolve_company_id(ctx, company_id)
        self._scope.validate_branch_access(ctx, branch_id)
        doc = self._numbers.generate(SvcEntityType.ESCALATION, cid, SvcServiceEscalation, "document_number")
        return self._repo.create(ctx, company_id=cid, branch_id=branch_id, document_number=doc, **fields)

    def update(self, ctx: TenantContext, row_id: UUID, **fields):
        self.get(ctx, row_id)
        row = self._repo.update(ctx, row_id, **fields)
        if row is None:
            raise NotFoundException("ServiceEscalationService not found")
        return row

    def escalate(self, ctx: TenantContext, row_id: UUID):
        row = self.get(ctx, row_id)
        self._engine.escalate(row)
        return self._repo.update(
            ctx,
            row_id,
            status=row.status,
            escalation_level=row.escalation_level,
        )

