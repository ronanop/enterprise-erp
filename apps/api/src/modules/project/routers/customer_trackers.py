"""Admin-only customer tracker upload and download endpoints."""

from typing import Annotated
from uuid import UUID

from fastapi import APIRouter, Depends
from fastapi.responses import FileResponse
from sqlalchemy.orm import Session

from modules.foundation.dependencies import require_permission
from modules.foundation.domain.value_objects import TenantContext
from modules.project.dependencies import get_db
from modules.project.schemas import CustomerTrackerCreate, CustomerTrackerResponse
from modules.project.service.customer_tracker_service import CustomerTrackerService
from shared.schemas import APIResponse

customer_trackers_router = APIRouter(prefix="/trackers", tags=["Project - Customer trackers"])


@customer_trackers_router.get("", response_model=APIResponse[list[CustomerTrackerResponse]])
def list_customer_trackers(
    ctx: Annotated[TenantContext, Depends(require_permission("project.project:read"))],
    db: Annotated[Session, Depends(get_db)],
):
    return APIResponse(message="OK", data=CustomerTrackerService(db).list(ctx))


@customer_trackers_router.post("", response_model=APIResponse[CustomerTrackerResponse])
def upload_customer_tracker(
    body: CustomerTrackerCreate,
    ctx: Annotated[TenantContext, Depends(require_permission("project.project:create"))],
    db: Annotated[Session, Depends(get_db)],
):
    row = CustomerTrackerService(db).create(ctx, **body.model_dump())
    return APIResponse(message="Tracker uploaded", data=row)


@customer_trackers_router.get("/{row_id}/file")
def download_customer_tracker(
    row_id: UUID,
    ctx: Annotated[TenantContext, Depends(require_permission("project.project:read"))],
    db: Annotated[Session, Depends(get_db)],
):
    row, path = CustomerTrackerService(db).get_file(ctx, row_id)
    return FileResponse(path, media_type=row.content_type or "application/octet-stream", filename=row.file_name)
