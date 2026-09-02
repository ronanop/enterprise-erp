"""Purchase order queue — finalized SCM POs for project creation."""

from typing import Annotated
from uuid import UUID

from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session

from modules.foundation.dependencies import require_permission
from modules.foundation.domain.value_objects import TenantContext
from modules.project.dependencies import get_db
from modules.project.schemas import (
    ProjectPoPrefillResponse,
    ProjectPoQueueHandoffResponse,
    ProjectPoQueueItem,
    ProjectPoQueueShareCreate,
)
from modules.project.service.project_po_queue_service import ProjectPoQueueService
from shared.schemas import APIResponse

purchase_orders_router = APIRouter(
    prefix="/purchase-orders",
    tags=["Project — Purchase Orders"],
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
