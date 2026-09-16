"""CRM attachment metadata service.

Accepts either a ``file_path`` (already-stored reference) or inline
``content_base64``. When S3 object storage is enabled, bytes are written to
the configured bucket and ``file_path`` stores an ``s3://`` URI; otherwise
files land under ``CRM_UPLOAD_ROOT``.
"""

from __future__ import annotations

import base64
import uuid
from dataclasses import dataclass
from pathlib import Path
from uuid import UUID

from sqlalchemy.orm import Session

from core import object_storage
from core.config import settings
from core.exceptions import NotFoundException
from modules.crm.repository.attachment_repository import AttachmentRepository
from modules.crm.service.crm_record_visibility import CrmRecordVisibility
from modules.crm.service.crm_scope_validator import CrmScopeValidator
from modules.foundation.domain.value_objects import TenantContext


def _upload_root() -> Path:
    return settings.resolved_crm_upload_root


@dataclass(frozen=True)
class AttachmentDownload:
    file_name: str
    content_type: str | None
    path: Path | None = None
    content: bytes | None = None


class AttachmentService:
    def __init__(self, db: Session) -> None:
        self._db = db
        self._repo = AttachmentRepository(db)
        self._scope = CrmScopeValidator(db)
        self._visibility = CrmRecordVisibility(db)

    def list_for_entity(self, ctx: TenantContext, entity_type: str, entity_id: UUID):
        return self._repo.list_for_entity(ctx, entity_type, entity_id)

    def list_by_category(
        self,
        ctx: TenantContext,
        *,
        category: str | None = None,
        company_id: UUID | None = None,
    ):
        cid = self._scope.resolve_company_id(ctx, company_id)
        rows = self._repo.list_by_category(ctx, cid, category=category)
        return self._visibility.filter_created_rows(ctx, rows)

    def get(self, ctx: TenantContext, row_id: UUID):
        row = self._repo.get(ctx, row_id)
        if row is None:
            raise NotFoundException("Attachment not found")
        return row

    def resolve_file_path(self, ctx: TenantContext, row_id: UUID) -> tuple[Path, str, str | None]:
        """Legacy local-path resolver. Prefer ``resolve_download`` for S3."""
        download = self.resolve_download(ctx, row_id)
        if download.path is None:
            raise NotFoundException("Attachment file is stored in object storage")
        return download.path, download.file_name, download.content_type

    def resolve_download(self, ctx: TenantContext, row_id: UUID) -> AttachmentDownload:
        row = self.get(ctx, row_id)
        stored = (row.file_path or "").strip()
        if object_storage.is_object_uri(stored):
            try:
                content = object_storage.get_bytes(stored)
            except Exception as exc:
                raise NotFoundException("Attachment file is missing in object storage") from exc
            return AttachmentDownload(
                file_name=row.file_name,
                content_type=row.content_type,
                content=content,
            )

        path = Path(stored)
        if not path.is_file():
            candidate = _upload_root() / path.name
            if candidate.is_file():
                path = candidate
            else:
                raise NotFoundException("Attachment file is missing on disk")
        return AttachmentDownload(
            file_name=row.file_name,
            content_type=row.content_type,
            path=path,
        )

    def remove_entity_attachments_by_category(
        self,
        ctx: TenantContext,
        entity_type: str,
        entity_id: UUID,
        category: str,
    ) -> int:
        removed = 0
        for row in self.list_for_entity(ctx, entity_type, entity_id):
            if row.category != category:
                continue
            self.delete(ctx, row.id)
            removed += 1
        return removed

    def create(
        self,
        ctx: TenantContext,
        *,
        entity_type: str,
        entity_id: UUID,
        file_name: str,
        category: str = "other",
        source: str = "upload",
        branch_id: UUID,
        company_id: UUID | None = None,
        file_path: str | None = None,
        content_base64: str | None = None,
        content_type: str | None = None,
    ):
        cid = self._scope.resolve_company_id(ctx, company_id)
        size: int | None = None
        stored_path = file_path

        if content_base64:
            raw = base64.b64decode(content_base64)
            size = len(raw)
            stored_name = f"{uuid.uuid4()}_{file_name}"
            if object_storage.is_enabled():
                key = object_storage.module_key("crm", "attachments", stored_name)
                stored_path = object_storage.put_bytes(
                    key, raw, content_type or "application/octet-stream"
                )
            else:
                upload_root = _upload_root()
                upload_root.mkdir(parents=True, exist_ok=True)
                dest = upload_root / stored_name
                dest.write_bytes(raw)
                stored_path = str(dest)
            source = "upload"

        if not stored_path:
            raise NotFoundException("Either file_path or content_base64 must be provided")

        row = self._repo.create(
            ctx,
            company_id=cid,
            branch_id=branch_id,
            entity_type=entity_type,
            entity_id=entity_id,
            file_name=file_name,
            file_path=stored_path,
            content_type=content_type,
            size=size,
            category=category,
            source=source,
            uploaded_by=ctx.user_id,
        )
        if entity_type == "opportunity":
            self._sync_opportunity_attachment_flags(ctx, entity_id)
        return row

    def delete(self, ctx: TenantContext, row_id: UUID) -> None:
        row = self.get(ctx, row_id)
        entity_type = row.entity_type
        entity_id = row.entity_id
        stored = (row.file_path or "").strip()
        if not self._repo.delete(ctx, row_id):
            raise NotFoundException("Attachment not found")
        self._delete_stored_bytes(stored)
        if entity_type == "opportunity":
            self._sync_opportunity_attachment_flags(ctx, entity_id)

    def _delete_stored_bytes(self, stored: str) -> None:
        if not stored:
            return
        try:
            if object_storage.is_object_uri(stored):
                object_storage.delete_object(stored)
                return
            path = Path(stored)
            if path.is_file():
                path.unlink()
                return
            candidate = _upload_root() / path.name
            if candidate.is_file():
                candidate.unlink()
        except OSError:
            pass

    def _sync_opportunity_attachment_flags(self, ctx: TenantContext, opportunity_id: UUID) -> None:
        from modules.crm.repository.opportunity_repository import OpportunityRepository

        rows = self._repo.list_for_entity(ctx, "opportunity", opportunity_id)
        categories = {r.category for r in rows}
        OpportunityRepository(self._db).update(
            ctx,
            opportunity_id,
            boq_attached="boq" in categories,
            sow_attached="sow" in categories,
            oem_quote_attached="oem_quote" in categories,
            customer_po_attached="customer_po" in categories,
        )
