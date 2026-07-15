"""ApprovalService."""

from uuid import UUID

from sqlalchemy.orm import Session

from core.exceptions import NotFoundException
from modules.document.domain.enums import DocEntityType
from modules.document.models import DocDocumentApproval
from modules.document.repository.document_approval_repository import DocumentApprovalRepository
from modules.document.service.document_number_service import DocumentNumberService
from modules.document.service.document_scope_validator import DocumentScopeValidator
from modules.document.service.engines import DocumentApprovalEngine
from modules.foundation.domain.value_objects import TenantContext
from modules.foundation.service.audit_service import AuditService


class ApprovalService:
    def __init__(self, db: Session) -> None:
        self._repo = DocumentApprovalRepository(db)
        self._scope = DocumentScopeValidator(db)
        self._numbers = DocumentNumberService(db)
        self._engine = DocumentApprovalEngine()
        self._audit = AuditService(db)

    def list(self, ctx: TenantContext, company_id: UUID | None = None):
        cid = self._scope.resolve_company_id(ctx, company_id)
        return self._repo.list_rows(ctx, cid)

    def get(self, ctx: TenantContext, row_id: UUID) -> DocDocumentApproval:
        row = self._repo.get(ctx, row_id)
        if row is None:
            raise NotFoundException("ApprovalService not found")
        return row

    def create(self, ctx: TenantContext, *, branch_id: UUID, company_id: UUID | None = None, **fields):

        cid = self._scope.resolve_company_id(ctx, company_id)
        self._scope.validate_branch_access(ctx, branch_id)
        doc = self._numbers.generate(DocEntityType.APPROVAL, cid, DocDocumentApproval, "document_number")
        return self._repo.create(ctx, company_id=cid, branch_id=branch_id, document_number=doc, **fields)

    def update(self, ctx: TenantContext, row_id: UUID, **fields):
        self.get(ctx, row_id)
        row = self._repo.update(ctx, row_id, **fields)
        if row is None:
            raise NotFoundException("ApprovalService not found")
        return row

    def submit(self, ctx: TenantContext, row_id: UUID):
        row = self.get(ctx, row_id)
        self._engine.submit(row)
        return self._repo.update(ctx, row_id, status=row.status)

    def complete(self, ctx: TenantContext, row_id: UUID):
        row = self.get(ctx, row_id)
        self._engine.complete(row)
        return self._repo.update(ctx, row_id, status=row.status)

