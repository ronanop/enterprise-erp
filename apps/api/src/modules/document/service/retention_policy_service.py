"""RetentionPolicyService."""

from uuid import UUID

from sqlalchemy.orm import Session

from core.exceptions import NotFoundException
from modules.document.domain.enums import DocEntityType
from modules.document.models import DocRetentionPolicy
from modules.document.repository.retention_policy_repository import RetentionPolicyRepository
from modules.document.service.document_number_service import DocumentNumberService
from modules.document.service.document_scope_validator import DocumentScopeValidator
from modules.document.service.engines import RetentionPolicyEngine
from modules.foundation.domain.value_objects import TenantContext
from modules.foundation.service.audit_service import AuditService


class RetentionPolicyService:
    def __init__(self, db: Session) -> None:
        self._repo = RetentionPolicyRepository(db)
        self._scope = DocumentScopeValidator(db)
        self._numbers = DocumentNumberService(db)
        self._engine = RetentionPolicyEngine()
        self._audit = AuditService(db)

    def list(self, ctx: TenantContext, company_id: UUID | None = None):
        cid = self._scope.resolve_company_id(ctx, company_id)
        return self._repo.list_rows(ctx, cid)

    def get(self, ctx: TenantContext, row_id: UUID) -> DocRetentionPolicy:
        row = self._repo.get(ctx, row_id)
        if row is None:
            raise NotFoundException("RetentionPolicyService not found")
        return row

    def create(self, ctx: TenantContext, company_id: UUID | None = None, **fields):

        cid = self._scope.resolve_company_id(ctx, company_id)
        doc = self._numbers.generate(DocEntityType.RETENTION, cid, DocRetentionPolicy, "policy_code")
        return self._repo.create(ctx, company_id=cid, policy_code=doc, **fields)

    def update(self, ctx: TenantContext, row_id: UUID, **fields):
        self.get(ctx, row_id)
        row = self._repo.update(ctx, row_id, **fields)
        if row is None:
            raise NotFoundException("RetentionPolicyService not found")
        return row

    def submit(self, ctx: TenantContext, row_id: UUID):
        row = self.get(ctx, row_id)
        self._engine.submit(row)
        return self._repo.update(ctx, row_id, status=row.status)

    def approve(self, ctx: TenantContext, row_id: UUID):
        row = self.get(ctx, row_id)
        self._engine.approve(row)
        return self._repo.update(ctx, row_id, status=row.status)

