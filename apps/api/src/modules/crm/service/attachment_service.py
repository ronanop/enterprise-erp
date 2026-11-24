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
from core.exceptions import NotFoundException, ValidationException
from modules.crm.repository.attachment_repository import AttachmentRepository
from modules.crm.service.crm_record_visibility import CrmRecordVisibility
from modules.crm.service.crm_scope_validator import CrmScopeValidator
from modules.foundation.domain.value_objects import TenantContext
from shared.upload_safety import (
    DEFAULT_MAX_ATTACHMENTS_PER_ENTITY,
    DEFAULT_MAX_UPLOAD_BYTES,
    OUTLOOK_MAIL_EXPORT_EXTENSIONS,
    OUTLOOK_MAIL_EXPORT_HINT,
    UnsafeUploadError,
    file_extension,
    sanitize_filename,
    validate_upload,
)

_OUTLOOK_ONLY_CATEGORIES = frozenset({"oem_quote", "vendor_quote"})


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
        cid = self._scope.resolve_list_company_id(ctx, company_id)
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
        replace_existing_category: bool = False,
    ):
        cid = self._scope.resolve_company_id(ctx, company_id)
        size: int | None = None
        stored_path = file_path
        safe_name = sanitize_filename(file_name)
        media_type = content_type

        if content_base64:
            raw = base64.b64decode(content_base64)
            try:
                safe_name, media_type = validate_upload(
                    file_name=safe_name,
                    content_type=content_type,
                    raw=raw,
                    max_bytes=DEFAULT_MAX_UPLOAD_BYTES,
                    allowed_extensions=(
                        OUTLOOK_MAIL_EXPORT_EXTENSIONS
                        if category in _OUTLOOK_ONLY_CATEGORIES
                        else None
                    ),
                )
            except UnsafeUploadError as exc:
                raise ValidationException(str(exc)) from exc
            existing = [
                row
                for row in self.list_for_entity(ctx, entity_type, entity_id)
                if (row.source or "upload") == "upload"
            ]
            if replace_existing_category:
                for row in list(existing):
                    if row.category == category:
                        self.delete(ctx, row.id)
                existing = [
                    row
                    for row in self.list_for_entity(ctx, entity_type, entity_id)
                    if (row.source or "upload") == "upload"
                ]
            if len(existing) >= DEFAULT_MAX_ATTACHMENTS_PER_ENTITY:
                raise ValidationException(
                    f"Attachment limit of {DEFAULT_MAX_ATTACHMENTS_PER_ENTITY} files per record exceeded"
                )
            size = len(raw)
            stored_name = f"{uuid.uuid4()}_{safe_name}"
            if object_storage.is_enabled():
                key = object_storage.module_key("crm", "attachments", stored_name)
                stored_path = object_storage.put_bytes(
                    key, raw, media_type or "application/octet-stream"
                )
            else:
                upload_root = _upload_root()
                upload_root.mkdir(parents=True, exist_ok=True)
                dest = upload_root / stored_name
                dest.write_bytes(raw)
                stored_path = str(dest)
            source = "upload"
        else:
            # Linked path uploads for vendor quotation still need Outlook export extension.
            if category in _OUTLOOK_ONLY_CATEGORIES:
                if file_extension(safe_name) not in OUTLOOK_MAIL_EXPORT_EXTENSIONS:
                    raise ValidationException(OUTLOOK_MAIL_EXPORT_HINT)
            # Link/cloud references still must not carry active filenames.
            safe_name = sanitize_filename(file_name)
            if Path(safe_name).suffix.lower() in {
                ".html",
                ".htm",
                ".xhtml",
                ".svg",
                ".js",
            }:
                raise ValidationException("Active web file types are not allowed as attachments")

        if not stored_path:
            raise NotFoundException("Either file_path or content_base64 must be provided")

        row = self._repo.create(
            ctx,
            company_id=cid,
            branch_id=branch_id,
            entity_type=entity_type,
            entity_id=entity_id,
            file_name=safe_name,
            file_path=stored_path,
            content_type=media_type,
            size=size,
            category=category,
            source=source,
            uploaded_by=ctx.user_id,
        )
        if entity_type == "opportunity":
            self._sync_opportunity_attachment_flags(ctx, entity_id)
        elif entity_type == "lead":
            self._sync_lead_attachment_flags(ctx, entity_id)
        self._notify_owner_document_submitted(ctx, entity_type, entity_id, category)
        return row

    def _notify_owner_document_submitted(
        self,
        ctx: TenantContext,
        entity_type: str,
        entity_id: UUID,
        category: str,
    ) -> None:
        try:
            from modules.crm.models.lead import CrmLead
            from modules.crm.models.opportunity import CrmOpportunity
            from modules.crm.service.crm_email_notification_service import (
                CrmEmailNotificationService,
                entity_record_url,
            )

            doc_type = (category or "document").replace("_", " ").title()
            owner_employee_id = None
            record_title = doc_type
            if entity_type == "opportunity":
                opp = self._db.get(CrmOpportunity, entity_id)
                if opp is None or getattr(opp, "is_deleted", False):
                    return
                owner_employee_id = opp.owner_employee_id
                record_title = opp.opportunity_name or doc_type
            elif entity_type == "lead":
                lead = self._db.get(CrmLead, entity_id)
                if lead is None or getattr(lead, "is_deleted", False):
                    return
                owner_employee_id = lead.owner_employee_id
                record_title = (
                    (lead.project_title or "").strip()
                    or f"{lead.first_name} {(lead.last_name or '').strip()}".strip()
                    or lead.lead_code
                )
            else:
                return

            CrmEmailNotificationService(self._db).notify_owner_document_submitted(
                tenant_id=ctx.tenant_id,
                owner_employee_id=owner_employee_id,
                actor_user_id=ctx.user_id,
                document_type=doc_type,
                record_title=record_title,
                record_url=entity_record_url(entity_type, entity_id),
                created_by=ctx.user_id,
            )
        except Exception:  # noqa: BLE001
            pass

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
        elif entity_type == "lead":
            self._sync_lead_attachment_flags(ctx, entity_id)

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

    def _sync_lead_attachment_flags(self, ctx: TenantContext, lead_id: UUID) -> None:
        from modules.crm.repository.lead_repository import LeadRepository

        rows = self._repo.list_for_entity(ctx, "lead", lead_id)
        categories = {r.category for r in rows}
        LeadRepository(self._db).update(
            ctx,
            lead_id,
            boq_attached="boq" in categories,
            sow_attached="sow" in categories,
        )
