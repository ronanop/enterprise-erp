"""Purchase order queue - finalized SCM POs for project creation."""

from typing import Annotated
from uuid import UUID

from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session

from modules.foundation.dependencies import require_permission
from modules.foundation.domain.value_objects import TenantContext
from modules.project.dependencies import get_db
from modules.project.schemas import (
    CreateCloudProjectRequest,
    ProjectPoPrefillResponse,
    ProjectPoQueueHandoffResponse,
    ProjectPoQueueItem,
    ProjectPoQueueShareCreate,
    ProjectResponse,
)
from modules.project.service.project_po_queue_service import ProjectPoQueueService
from modules.project.service.project_service import ProjectService
from shared.schemas import APIResponse

purchase_orders_router = APIRouter(
    prefix="/purchase-orders",
    tags=["Project - Purchase Orders"],
)


@purchase_orders_router.get("/queue", response_model=APIResponse[list[ProjectPoQueueItem]])
def list_project_po_queue(
    ctx: Annotated[TenantContext, Depends(require_permission("project.project:read"))],
    db: Annotated[Session, Depends(get_db)],
    company_id: UUID | None = None,
):
    rows = ProjectPoQueueService(db).list_queue(ctx, company_id=company_id)
    return APIResponse(message="OK", data=rows)


@purchase_orders_router.post(
    "/queue/share",
    response_model=APIResponse[ProjectPoQueueHandoffResponse],
)
def share_project_po_queue(
    payload: ProjectPoQueueShareCreate,
    ctx: Annotated[TenantContext, Depends(require_permission("procurement.order:update"))],
    db: Annotated[Session, Depends(get_db)],
):
    data = ProjectPoQueueService(db).share_to_queue(ctx, payload)
    return APIResponse(message="Shared to PO queue", data=data)


@purchase_orders_router.get(
    "/handoffs/{handoff_id}",
    response_model=APIResponse[ProjectPoQueueHandoffResponse | None],
)
def get_project_po_handoff_by_id(
    handoff_id: UUID,
    ctx: Annotated[TenantContext, Depends(require_permission("project.project:read"))],
    db: Annotated[Session, Depends(get_db)],
):
    data = ProjectPoQueueService(db).get_handoff_by_id(ctx, handoff_id)
    return APIResponse(message="OK", data=data)


@purchase_orders_router.get(
    "/handoffs/{handoff_id}/prefill",
    response_model=APIResponse[ProjectPoPrefillResponse],
)
def get_project_po_prefill_by_handoff(
    handoff_id: UUID,
    ctx: Annotated[TenantContext, Depends(require_permission("project.project:read"))],
    db: Annotated[Session, Depends(get_db)],
):
    data = ProjectPoQueueService(db).get_prefill_by_handoff(ctx, handoff_id)
    return APIResponse(message="OK", data=data)


@purchase_orders_router.post(
    "/handoffs/{handoff_id}/create-cloud-project",
    response_model=APIResponse[ProjectResponse],
)
def create_cloud_project_from_handoff(
    handoff_id: UUID,
    ctx: Annotated[TenantContext, Depends(require_permission("project.project:create"))],
    db: Annotated[Session, Depends(get_db)],
    body: CreateCloudProjectRequest | None = None,
):
    """One-click create: one project per cloud, skips the intake form."""
    payload = body or CreateCloudProjectRequest()
    row = ProjectPoQueueService(db).create_cloud_project_from_handoff(
        ctx,
        handoff_id,
        rfai_number=payload.rfai_number,
        project_manager_employee_id=payload.project_manager_employee_id,
    )
    data = ProjectService(db).to_response(ctx, row)
    return APIResponse(message="Project created", data=data)


@purchase_orders_router.get(
    "/{order_id}/handoff",
    response_model=APIResponse[ProjectPoQueueHandoffResponse | None],
)
def get_project_po_handoff(
    order_id: UUID,
    ctx: Annotated[TenantContext, Depends(require_permission("project.project:read"))],
    db: Annotated[Session, Depends(get_db)],
):
    data = ProjectPoQueueService(db).get_handoff(ctx, order_id)
    return APIResponse(message="OK", data=data)


@purchase_orders_router.get(
    "/{order_id}/prefill",
    response_model=APIResponse[ProjectPoPrefillResponse],
)
def get_project_po_prefill(
    order_id: UUID,
    ctx: Annotated[TenantContext, Depends(require_permission("project.project:read"))],
    db: Annotated[Session, Depends(get_db)],
):
    data = ProjectPoQueueService(db).get_prefill(ctx, order_id)
    return APIResponse(message="OK", data=data)
