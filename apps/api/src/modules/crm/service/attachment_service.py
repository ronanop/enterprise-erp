"""CRM attachment metadata service.

Accepts either a ``file_path`` (already-stored reference) or inline
``content_base64`` which is decoded and written to the local uploads
directory — this keeps the demo self-contained without requiring a full
multipart/object-storage pipeline.
"""

import base64
import uuid
from pathlib import Path
from uuid import UUID

from sqlalchemy.orm import Session

from core.exceptions import NotFoundException
from modules.crm.repository.attachment_repository import AttachmentRepository
from modules.crm.service.crm_scope_validator import CrmScopeValidator
from modules.foundation.domain.value_objects import TenantContext

UPLOAD_ROOT = Path(__file__).resolve().parents[4] / "var" / "crm-attachments"


class AttachmentService:
    def __init__(self, db: Session) -> None:
        self._repo = AttachmentRepository(db)
        self._scope = CrmScopeValidator(db)

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
        return self._repo.list_by_category(ctx, cid, category=category)

    def get(self, ctx: TenantContext, row_id: UUID):
        row = self._repo.get(ctx, row_id)
        if row is None:
            raise NotFoundException("Attachment not found")
        return row

    def resolve_file_path(self, ctx: TenantContext, row_id: UUID) -> tuple[Path, str, str | None]:
        """Return (path, file_name, content_type) for streaming download."""
        row = self.get(ctx, row_id)
        path = Path(row.file_path)
        if not path.is_file():
            # Fallback: file may have been stored relative to the upload root.
            candidate = UPLOAD_ROOT / path.name
            if candidate.is_file():
                path = candidate
            else:
                raise NotFoundException("Attachment file is missing on disk")
        return path, row.file_name, row.content_type

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
            UPLOAD_ROOT.mkdir(parents=True, exist_ok=True)
            raw = base64.b64decode(content_base64)
            size = len(raw)
            dest = UPLOAD_ROOT / f"{uuid.uuid4()}_{file_name}"
            dest.write_bytes(raw)
            stored_path = str(dest)
            source = "upload"

        if not stored_path:
            raise NotFoundException("Either file_path or content_base64 must be provided")

        return self._repo.create(
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
