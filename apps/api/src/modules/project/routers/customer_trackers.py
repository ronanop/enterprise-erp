"""Admin-only customer tracker sheet endpoints (in-app table + download)."""

from typing import Annotated
from uuid import UUID

from fastapi import APIRouter, Depends
from fastapi.responses import FileResponse
from sqlalchemy.orm import Session

from modules.foundation.dependencies import require_permission
from modules.foundation.domain.value_objects import TenantContext
from modules.project.dependencies import get_db
from modules.project.schemas import (
    CustomerTrackerCreate,
    CustomerTrackerGridCreate,
    CustomerTrackerGridResponse,
    CustomerTrackerResponse,
)
from modules.project.service.customer_tracker_service import CustomerTrackerService
from shared.schemas import APIResponse

customer_trackers_router = APIRouter(prefix="/trackers", tags=["Project - Customer trackers"])


def _to_response(row) -> CustomerTrackerResponse:
    return CustomerTrackerResponse.model_validate(
        {
            "id": row.id,
            "project_id": row.project_id,
            "version_no": row.version_no,
            "file_name": row.file_name,
            "content_type": row.content_type,
            "file_size": row.file_size,
            "content_hash": row.content_hash,
            "remarks": row.remarks,
            "company_id": row.company_id,
            "branch_id": row.branch_id,
            "created_at": row.created_at,
            "created_by": row.created_by,
            "is_grid": bool(getattr(row, "is_grid", False)),
            "column_count": getattr(row, "column_count", None),
            "row_count": getattr(row, "row_count", None),
        }
    )


@customer_trackers_router.get("", response_model=APIResponse[list[CustomerTrackerResponse]])
def list_customer_trackers(
    ctx: Annotated[TenantContext, Depends(require_permission("project.project:read"))],
    db: Annotated[Session, Depends(get_db)],
):
    rows = CustomerTrackerService(db).list(ctx)
    return APIResponse(message="OK", data=[_to_response(r) for r in rows])


@customer_trackers_router.post("", response_model=APIResponse[CustomerTrackerResponse])
def upload_customer_tracker(
    body: CustomerTrackerCreate,
    ctx: Annotated[TenantContext, Depends(require_permission("project.project:create"))],
    db: Annotated[Session, Depends(get_db)],
):
    row = CustomerTrackerService(db).create(ctx, **body.model_dump())
    return APIResponse(message="Tracker uploaded", data=_to_response(row))


@customer_trackers_router.post("/grid", response_model=APIResponse[CustomerTrackerResponse])
def create_customer_tracker_grid(
    body: CustomerTrackerGridCreate,
    ctx: Annotated[TenantContext, Depends(require_permission("project.project:create"))],
    db: Annotated[Session, Depends(get_db)],
):
    row = CustomerTrackerService(db).create_grid(
        ctx,
        project_id=body.project_id,
        grid=body.grid,
        remarks=body.remarks,
        title=body.title,
        company_id=body.company_id,
    )
    return APIResponse(message="Tracker table saved", data=_to_response(row))


@customer_trackers_router.get(
    "/{row_id}/grid",
    response_model=APIResponse[CustomerTrackerGridResponse],
)
def get_customer_tracker_grid(
    row_id: UUID,
    ctx: Annotated[TenantContext, Depends(require_permission("project.project:read"))],
    db: Annotated[Session, Depends(get_db)],
):
    data = CustomerTrackerService(db).get_grid(ctx, row_id)
    return APIResponse(message="OK", data=data)


@customer_trackers_router.get("/{row_id}/file")
def download_customer_tracker(
    row_id: UUID,
    ctx: Annotated[TenantContext, Depends(require_permission("project.project:read"))],
    db: Annotated[Session, Depends(get_db)],
):
    row, path = CustomerTrackerService(db).get_file(ctx, row_id)
    return FileResponse(
        path,
        media_type=row.content_type or "application/octet-stream",
        filename=row.file_name,
    )
