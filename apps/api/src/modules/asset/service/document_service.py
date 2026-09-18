"""DocumentService — asset document metadata + binary upload (FP-ASSET-016)."""

from __future__ import annotations

import hashlib
from io import BytesIO
from typing import BinaryIO
from uuid import UUID

from sqlalchemy.orm import Session

from core.exceptions import NotFoundException
from modules.asset.domain.enums import AssetDocumentStatus
from modules.asset.domain.exceptions import DocumentValidationError
from modules.asset.models import AstAssetDocument
from modules.asset.repository.asset_document_repository import (
    AssetDocumentListFilters,
    AssetDocumentRepository,
)
from modules.asset.schemas import AssetDocumentResponse, AssetDocumentUploadLimits
from modules.asset.service.asset_scope_validator import AssetScopeValidator
from modules.asset.service.document_file import (
    build_asset_doc_uri,
    build_storage_key,
    document_type_for_content_type,
    is_https_pointer,
    parse_asset_doc_uri,
    upload_limits_payload,
    validate_upload_bytes,
)
from modules.asset.service.document_validator import DocumentValidator
from modules.asset.service.engines import AssetDocumentEngine
from modules.asset.storage import StorageBackend, get_storage
from modules.foundation.domain.value_objects import TenantContext
from modules.foundation.service.audit_service import AuditService

ENTITY_AST_DOCUMENT = "ast_asset_document"


class DocumentService:
    def __init__(self, db: Session, storage: StorageBackend | None = None) -> None:
        self._repo = AssetDocumentRepository(db)
        self._scope = AssetScopeValidator(db)
        self._engine = AssetDocumentEngine()
        self._audit = AuditService(db)
        self._validator = DocumentValidator(db)
        self._storage = storage if storage is not None else get_storage()

    def upload_limits(self) -> AssetDocumentUploadLimits:
        payload = upload_limits_payload()
        return AssetDocumentUploadLimits(**payload)

    def to_response(self, row: AstAssetDocument) -> AssetDocumentResponse:
        meta = parse_asset_doc_uri(row.storage_uri)
        downloadable = bool(meta.is_stored or is_https_pointer(row.storage_uri))
        return AssetDocumentResponse(
            id=row.id,
            branch_id=row.branch_id,
            asset_id=row.asset_id,
            document_type=row.document_type,
            document_name=row.document_name,
            storage_uri=row.storage_uri,
            content_hash=row.content_hash,
            status=row.status,
            company_id=row.company_id,
            version=int(row.version or 1),
            created_at=getattr(row, "created_at", None),
            content_type=meta.content_type,
            file_size_bytes=meta.file_size_bytes,
            downloadable=downloadable,
        )

    def search(
        self,
        ctx: TenantContext,
        *,
        company_id: UUID | None = None,
        asset_id: UUID | None = None,
        document_type: str | None = None,
        branch_id: UUID | None = None,
        status: str | None = None,
        search: str | None = None,
        offset: int = 0,
        limit: int = 25,
    ) -> tuple[list[AstAssetDocument], int]:
        cid = self._scope.resolve_company_id(ctx, company_id)
        filters = AssetDocumentListFilters(
            company_id=cid,
            asset_id=asset_id,
            document_type=document_type,
            branch_id=branch_id,
            status=status,
            search=search,
        )
        return self._repo.search(ctx, filters, offset=offset, limit=limit)

    def list(self, ctx: TenantContext, company_id: UUID | None = None):
        cid = self._scope.resolve_company_id(ctx, company_id)
        return self._repo.list_rows(ctx, cid)

    def get(self, ctx: TenantContext, row_id: UUID) -> AstAssetDocument:
        row = self._repo.get(ctx, row_id)
        if row is None:
            raise NotFoundException("Document not found")
        return row

    def create(self, ctx: TenantContext, company_id: UUID | None = None, **fields):
        cid = self._scope.resolve_company_id(ctx, company_id)
        branch_id = fields.get("branch_id")
        if branch_id is not None:
            self._scope.validate_branch_access(ctx, branch_id)

        fields.pop("status", None)
        self._validator.validate_create_fields(ctx, company_id=cid, fields=fields)

        row = self._repo.create(
            ctx,
            company_id=cid,
            branch_id=fields.get("branch_id"),
            asset_id=fields["asset_id"],
            document_type=str(fields["document_type"]).strip(),
            document_name=str(fields["document_name"]).strip(),
            storage_uri=fields.get("storage_uri"),
            content_hash=fields.get("content_hash"),
            status=AssetDocumentStatus.ACTIVE.value,
        )
        self._audit.log_entity_change(
            tenant_id=ctx.tenant_id,
            entity_name=ENTITY_AST_DOCUMENT,
            entity_id=row.id,
            operation="create",
            performed_by=ctx.user_id,
            new_value={
                "asset_id": str(row.asset_id),
                "document_type": row.document_type,
                "document_name": row.document_name,
            },
        )
        return row

    def upload(
        self,
        ctx: TenantContext,
        *,
        asset_id: UUID,
        file_bytes: bytes,
        original_filename: str | None,
        declared_content_type: str | None = None,
        document_type: str | None = None,
        company_id: UUID | None = None,
        branch_id: UUID | None = None,
    ) -> AstAssetDocument:
        content_type, filename, size = validate_upload_bytes(
            file_bytes,
            declared_content_type=declared_content_type,
            original_filename=original_filename,
        )
        resolved_type = (document_type or document_type_for_content_type(content_type)).strip()
        storage_key = build_storage_key(str(asset_id), content_type)
        self._storage.save(BytesIO(file_bytes), storage_key)
        storage_uri = build_asset_doc_uri(
            storage_key,
            content_type=content_type,
            file_size_bytes=size,
        )
        content_hash = hashlib.sha256(file_bytes).hexdigest()
        try:
            return self.create(
                ctx,
                company_id=company_id,
                branch_id=branch_id,
                asset_id=asset_id,
                document_type=resolved_type,
                document_name=filename,
                storage_uri=storage_uri,
                content_hash=content_hash,
            )
        except Exception:
            try:
                self._storage.delete(storage_key)
            except Exception:
                pass
            raise

    def open_stored_content(
        self,
        ctx: TenantContext,
        row_id: UUID,
    ) -> tuple[BinaryIO, str, str | None, int | None]:
        row = self.get(ctx, row_id)
        meta = parse_asset_doc_uri(row.storage_uri)
        if not meta.is_stored or not meta.storage_key:
            if is_https_pointer(row.storage_uri):
                raise DocumentValidationError(
                    "This document is an external link. Open it from the document URL."
                )
            raise DocumentValidationError("No downloadable file is attached to this document")
        if not self._storage.exists(meta.storage_key):
            raise NotFoundException("Stored document file is missing")
        handle = self._storage.open(meta.storage_key)
        return handle, row.document_name, meta.content_type, meta.file_size_bytes

    def update(self, ctx: TenantContext, row_id: UUID, **fields):
        row = self.get(ctx, row_id)
        branch_id = fields.get("branch_id")
        if branch_id is not None:
            self._scope.validate_branch_access(ctx, branch_id)
        self._validator.validate_update_fields(ctx, row, fields)
        updated = self._repo.update(ctx, row_id, **fields)
        if updated is None:
            raise NotFoundException("Document not found")
        self._audit.log_entity_change(
            tenant_id=ctx.tenant_id,
            entity_name=ENTITY_AST_DOCUMENT,
            entity_id=row_id,
            operation="update",
            performed_by=ctx.user_id,
        )
        return updated

    def supersede(self, ctx: TenantContext, row_id: UUID):
        row = self.get(ctx, row_id)
        self._validator.validate_supersede_readiness(ctx, row)
        claimed = self._repo.update(ctx, row_id, version=int(row.version or 1))
        if claimed is None:
            raise NotFoundException("Document not found")
        self._engine.supersede(claimed)
        updated = self._repo.update(
            ctx,
            row_id,
            status=claimed.status,
            version=int(claimed.version or 1),
        )
        self._audit.log_entity_change(
            tenant_id=ctx.tenant_id,
            entity_name=ENTITY_AST_DOCUMENT,
            entity_id=row_id,
            operation="supersede",
            performed_by=ctx.user_id,
        )
        return updated

    def archive(self, ctx: TenantContext, row_id: UUID):
        row = self.get(ctx, row_id)
        self._validator.validate_archive_readiness(ctx, row)
        claimed = self._repo.update(ctx, row_id, version=int(row.version or 1))
        if claimed is None:
            raise NotFoundException("Document not found")
        self._engine.archive(claimed)
        updated = self._repo.update(
            ctx,
            row_id,
            status=claimed.status,
            version=int(claimed.version or 1),
        )
        self._audit.log_entity_change(
            tenant_id=ctx.tenant_id,
            entity_name=ENTITY_AST_DOCUMENT,
            entity_id=row_id,
            operation="archive",
            performed_by=ctx.user_id,
        )
        return updated
