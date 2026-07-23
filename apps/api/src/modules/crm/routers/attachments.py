"""CRM Attachment metadata REST endpoints (BOQ / SOW / OEM quote / customer PO / vendor quote / other)."""

from typing import Annotated
from uuid import UUID

from fastapi import APIRouter, Depends
from fastapi.responses import FileResponse
from sqlalchemy.orm import Session

from modules.crm.dependencies import get_db
from modules.crm.schemas import AttachmentCreate, AttachmentResponse
from modules.crm.service import AttachmentService
from modules.foundation.dependencies import require_permission
from modules.foundation.domain.value_objects import TenantContext
from shared.schemas import APIResponse

attachments_router = APIRouter(prefix="/attachments", tags=["CRM - Attachments"])


@attachments_router.get("", response_model=APIResponse[list[AttachmentResponse]])
def list_attachments(
    ctx: Annotated[TenantContext, Depends(require_permission("crm.attachment:read"))],
    db: Annotated[Session, Depends(get_db)],
    entity_type: str | None = None,
    entity_id: UUID | None = None,
    category: str | None = None,
    company_id: UUID | None = None,
):
    service = AttachmentService(db)
    if entity_type and entity_id:
        rows = service.list_for_entity(ctx, entity_type, entity_id)
        if category:
            rows = [row for row in rows if row.category == category]
        return APIResponse(message="OK", data=rows)
    rows = service.list_by_category(ctx, category=category, company_id=company_id)
    return APIResponse(message="OK", data=rows)


@attachments_router.post("", response_model=APIResponse[AttachmentResponse])
def create_attachment(
    body: AttachmentCreate,
    ctx: Annotated[TenantContext, Depends(require_permission("crm.attachment:create"))],
    db: Annotated[Session, Depends(get_db)],
):
    return APIResponse(message="OK", data=AttachmentService(db).create(ctx, **body.model_dump()))


@attachments_router.get("/{attachment_id}/content")
def download_attachment(
    attachment_id: UUID,
    ctx: Annotated[TenantContext, Depends(require_permission("crm.attachment:read"))],
    db: Annotated[Session, Depends(get_db)],
):
    path, file_name, content_type = AttachmentService(db).resolve_file_path(ctx, attachment_id)
    return FileResponse(
        path=path,
        filename=file_name,
        media_type=content_type or "application/octet-stream",
        content_disposition_type="inline",
    )


@attachments_router.get("/{attachment_id}", response_model=APIResponse[AttachmentResponse])
def get_attachment(
    attachment_id: UUID,
    ctx: Annotated[TenantContext, Depends(require_permission("crm.attachment:read"))],
    db: Annotated[Session, Depends(get_db)],
):
    return APIResponse(message="OK", data=AttachmentService(db).get(ctx, attachment_id))
