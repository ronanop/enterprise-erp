"""Procurement purchase order routers."""

from typing import Annotated
from uuid import UUID

from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session

from database.session import get_db
from modules.foundation.dependencies import require_permission
from modules.foundation.domain.value_objects import TenantContext
from modules.procurement.dependencies import (
    PaginationParams,
    extract_update_fields,
    get_pagination,
    paginate,
)
from modules.procurement.schemas import (
    OrderCreateRequest,
    OrderLineCreateRequest,
    OrderLineResponse,
    OrderResponse,
    OrderUpdateRequest,
    WorkflowActionRequest,
)
from modules.procurement.service.order_service import OrderService
from shared.schemas import APIResponse

orders_router = APIRouter(prefix="/orders", tags=["Procurement - Orders"])


@orders_router.get("", response_model=APIResponse[list[OrderResponse]])
def list_orders(
    ctx: Annotated[TenantContext, Depends(require_permission("procurement.order:read"))],
    db: Annotated[Session, Depends(get_db)],
    pagination: Annotated[PaginationParams, Depends(get_pagination)],
    company_id: UUID | None = None,
    include_commercial: bool = False,
) -> APIResponse[list[OrderResponse]]:
    rows = OrderService(db).list_order_responses(
        ctx, company_id, enrich_commercial=include_commercial
    )
    page = paginate(rows, pagination)
    return APIResponse(
        message="Orders retrieved",
        data=page,
    )


@orders_router.post("", response_model=APIResponse[OrderResponse])
def create_order(
    body: OrderCreateRequest,
    ctx: Annotated[TenantContext, Depends(require_permission("procurement.order:create"))],
    db: Annotated[Session, Depends(get_db)],
) -> APIResponse[OrderResponse]:
    row = OrderService(db).create(ctx, **body.model_dump())
    db.commit()
    return APIResponse(message="Order created", data=OrderResponse.model_validate(row))


@orders_router.get("/{order_id}", response_model=APIResponse[OrderResponse])
def get_order(
    order_id: UUID,
    ctx: Annotated[TenantContext, Depends(require_permission("procurement.order:read"))],
    db: Annotated[Session, Depends(get_db)],
    include_commercial: bool = True,
) -> APIResponse[OrderResponse]:
    row = OrderService(db).get_order_response(
        ctx, order_id, enrich_commercial=include_commercial
    )
    return APIResponse(message="Order retrieved", data=row)


@orders_router.patch("/{order_id}", response_model=APIResponse[OrderResponse])
def update_order(
    order_id: UUID,
    body: OrderUpdateRequest,
    ctx: Annotated[TenantContext, Depends(require_permission("procurement.order:update"))],
    db: Annotated[Session, Depends(get_db)],
) -> APIResponse[OrderResponse]:
    row = OrderService(db).update(ctx, order_id, **extract_update_fields(body))
    db.commit()
    return APIResponse(message="Order updated", data=OrderResponse.model_validate(row))


@orders_router.post("/{order_id}/lines", response_model=APIResponse[OrderLineResponse])
def add_order_line(
    order_id: UUID,
    body: OrderLineCreateRequest,
    ctx: Annotated[TenantContext, Depends(require_permission("procurement.order:update"))],
    db: Annotated[Session, Depends(get_db)],
) -> APIResponse[OrderLineResponse]:
    line = OrderService(db).add_line(ctx, order_id, **body.model_dump())
    db.commit()
    return APIResponse(message="Order line added", data=OrderLineResponse.model_validate(line))


@orders_router.post("/{order_id}/submit", response_model=APIResponse[OrderResponse])
def submit_order(
    order_id: UUID,
    _body: WorkflowActionRequest,
    ctx: Annotated[TenantContext, Depends(require_permission("procurement.order:submit"))],
    db: Annotated[Session, Depends(get_db)],
) -> APIResponse[OrderResponse]:
    row = OrderService(db).submit(ctx, order_id)
    db.commit()
    return APIResponse(message="Order submitted", data=OrderResponse.model_validate(row))


@orders_router.post("/{order_id}/approve", response_model=APIResponse[dict])
def approve_order(
    order_id: UUID,
    _body: WorkflowActionRequest,
    ctx: Annotated[TenantContext, Depends(require_permission("procurement.order:approve"))],
    db: Annotated[Session, Depends(get_db)],
) -> APIResponse[dict]:
    instance = OrderService(db).approve(ctx, order_id)
    db.commit()
    return APIResponse(message="Order approved", data={"status": instance.status})


@orders_router.post("/{order_id}/send", response_model=APIResponse[OrderResponse])
def send_order(
    order_id: UUID,
    ctx: Annotated[TenantContext, Depends(require_permission("procurement.order:send"))],
    db: Annotated[Session, Depends(get_db)],
) -> APIResponse[OrderResponse]:
    row = OrderService(db).send(ctx, order_id)
    db.commit()
    return APIResponse(message="Order sent", data=OrderResponse.model_validate(row))


@orders_router.post("/{order_id}/cancel", response_model=APIResponse[OrderResponse])
def cancel_order(
    order_id: UUID,
    ctx: Annotated[TenantContext, Depends(require_permission("procurement.order:cancel"))],
    db: Annotated[Session, Depends(get_db)],
) -> APIResponse[OrderResponse]:
    row = OrderService(db).cancel(ctx, order_id)
    db.commit()
    return APIResponse(message="Order cancelled", data=OrderResponse.model_validate(row))
