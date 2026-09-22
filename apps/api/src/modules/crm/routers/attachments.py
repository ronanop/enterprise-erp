"""CRM Attachment metadata REST endpoints (BOQ / SOW / OEM quote / customer PO / vendor quote / other)."""

from io import BytesIO
from typing import Annotated
from uuid import UUID

from fastapi import APIRouter, Depends
from fastapi.responses import FileResponse, StreamingResponse
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
    download = AttachmentService(db).resolve_download(ctx, attachment_id)
    media = download.content_type or "application/octet-stream"
    if download.path is not None:
        return FileResponse(
            path=download.path,
            filename=download.file_name,
            media_type=media,
            content_disposition_type="inline",
        )
    return StreamingResponse(
        BytesIO(download.content or b""),
        media_type=media,
        headers={
            "Content-Disposition": f'inline; filename="{download.file_name}"',
        },
    )


@attachments_router.get("/{attachment_id}", response_model=APIResponse[AttachmentResponse])
def get_attachment(
    attachment_id: UUID,
    ctx: Annotated[TenantContext, Depends(require_permission("crm.attachment:read"))],
    db: Annotated[Session, Depends(get_db)],
):
    return APIResponse(message="OK", data=AttachmentService(db).get(ctx, attachment_id))


@attachments_router.delete("/{attachment_id}", response_model=APIResponse[None])
def delete_attachment(
    attachment_id: UUID,
    ctx: Annotated[TenantContext, Depends(require_permission("crm.attachment:delete"))],
    db: Annotated[Session, Depends(get_db)],
):
    AttachmentService(db).delete(ctx, attachment_id)
    return APIResponse(message="Deleted", data=None)
