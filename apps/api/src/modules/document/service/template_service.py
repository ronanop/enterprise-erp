"""TemplateService — templates and template fields."""

from uuid import UUID

from sqlalchemy.orm import Session

from core.exceptions import NotFoundException
from modules.document.models import DocTemplate, DocTemplateField
from modules.document.repository.template_field_repository import TemplateFieldRepository
from modules.document.repository.template_repository import TemplateRepository
from modules.document.service.document_scope_validator import DocumentScopeValidator
from modules.document.service.engines import TemplateEngine, TemplateFieldEngine
from modules.foundation.domain.value_objects import TenantContext
from modules.foundation.service.audit_service import AuditService


class TemplateService:
    def __init__(self, db: Session) -> None:
        self._tpl_repo = TemplateRepository(db)
        self._field_repo = TemplateFieldRepository(db)
        self._scope = DocumentScopeValidator(db)
        self._tpl_engine = TemplateEngine()
        self._field_engine = TemplateFieldEngine()
        self._audit = AuditService(db)

    def list(self, ctx: TenantContext, company_id: UUID | None = None):
        cid = self._scope.resolve_company_id(ctx, company_id)
        return self._tpl_repo.list_rows(ctx, cid)

    def get(self, ctx: TenantContext, row_id: UUID) -> DocTemplate | DocTemplateField:
        row = self._tpl_repo.get(ctx, row_id)
        if row is not None:
            return row
        row = self._field_repo.get(ctx, row_id)
        if row is None:
            raise NotFoundException("TemplateService not found")
        return row

    def create(self, ctx: TenantContext, company_id: UUID | None = None, **fields):
        cid = self._scope.resolve_company_id(ctx, company_id)
        if "template_id" in fields and "template_code" not in fields:
            row = self._field_repo.create(ctx, company_id=cid, **fields)
            entity_name = "doc_template_field"
        else:
            row = self._tpl_repo.create(ctx, company_id=cid, **fields)
            entity_name = "doc_template"
        self._audit.log_entity_change(
            tenant_id=ctx.tenant_id,
            entity_name=entity_name,
            entity_id=row.id,
            operation="create",
            performed_by=ctx.user_id,
        )
        return row

    def update(self, ctx: TenantContext, row_id: UUID, **fields):
        if self._tpl_repo.get(ctx, row_id) is not None:
            row = self._tpl_repo.update(ctx, row_id, **fields)
        else:
            row = self._field_repo.update(ctx, row_id, **fields)
        if row is None:
            raise NotFoundException("TemplateService not found")
        return row
