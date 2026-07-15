"""TagService — tags and tag-map operations."""

from uuid import UUID

from sqlalchemy.orm import Session

from core.exceptions import NotFoundException
from modules.document.models import DocDocumentTag, DocDocumentTagMap
from modules.document.repository.document_tag_map_repository import DocumentTagMapRepository
from modules.document.repository.document_tag_repository import DocumentTagRepository
from modules.document.service.document_scope_validator import DocumentScopeValidator
from modules.document.service.engines import DocumentTagEngine, DocumentTagMapEngine
from modules.foundation.domain.value_objects import TenantContext
from modules.foundation.service.audit_service import AuditService


class TagService:
    def __init__(self, db: Session) -> None:
        self._tag_repo = DocumentTagRepository(db)
        self._map_repo = DocumentTagMapRepository(db)
        self._scope = DocumentScopeValidator(db)
        self._tag_engine = DocumentTagEngine()
        self._map_engine = DocumentTagMapEngine()
        self._audit = AuditService(db)

    def list(self, ctx: TenantContext, company_id: UUID | None = None):
        cid = self._scope.resolve_company_id(ctx, company_id)
        return self._tag_repo.list_rows(ctx, cid)

    def get(self, ctx: TenantContext, row_id: UUID) -> DocDocumentTag | DocDocumentTagMap:
        row = self._tag_repo.get(ctx, row_id)
        if row is not None:
            return row
        row = self._map_repo.get(ctx, row_id)
        if row is None:
            raise NotFoundException("TagService not found")
        return row

    def create(self, ctx: TenantContext, company_id: UUID | None = None, **fields):
        cid = self._scope.resolve_company_id(ctx, company_id)
        if ("tag_id" in fields or "document_id" in fields) and "tag_code" not in fields:
            row = self._map_repo.create(ctx, company_id=cid, **fields)
            entity_name = "doc_document_tag_map"
        else:
            row = self._tag_repo.create(ctx, company_id=cid, **fields)
            entity_name = "doc_document_tag"
        self._audit.log_entity_change(
            tenant_id=ctx.tenant_id,
            entity_name=entity_name,
            entity_id=row.id,
            operation="create",
            performed_by=ctx.user_id,
        )
        return row

    def update(self, ctx: TenantContext, row_id: UUID, **fields):
        if self._tag_repo.get(ctx, row_id) is not None:
            row = self._tag_repo.update(ctx, row_id, **fields)
        else:
            row = self._map_repo.update(ctx, row_id, **fields)
        if row is None:
            raise NotFoundException("TagService not found")
        return row
