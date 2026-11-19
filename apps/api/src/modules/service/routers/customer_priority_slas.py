"""CRUD for customer + priority SLA policies."""

from typing import Annotated
from uuid import UUID

from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session

from modules.service.dependencies import TenantContext, get_db, require_permission
from modules.service.service.customer_priority_sla_service import CustomerPrioritySlaService
from modules.service.service_itsm_schemas import (
    CustomerPrioritySlaCreate,
    CustomerPrioritySlaResponse,
    CustomerPrioritySlaUpdate,
)
from shared.schemas import APIResponse

customer_priority_slas_router = APIRouter(
    prefix="/customer-priority-slas",
    tags=["Service — Customer Priority SLAs"],
)


@customer_priority_slas_router.get("", response_model=APIResponse[list[CustomerPrioritySlaResponse]])
def list_customer_priority_slas(
    ctx: Annotated[TenantContext, Depends(require_permission("service.request:read"))],
    db: Annotated[Session, Depends(get_db)],
    company_id: UUID | None = None,
    customer_id: UUID | None = None,
    priority: str | None = None,
    active_only: bool = False,
):
    items = CustomerPrioritySlaService(db).list(
        ctx,
        company_id=company_id,
        customer_id=customer_id,
        priority=priority,
        active_only=active_only,
    )
    return APIResponse(message="OK", data=items)


@customer_priority_slas_router.get("/{row_id}", response_model=APIResponse[CustomerPrioritySlaResponse])
def get_customer_priority_sla(
    row_id: UUID,
    ctx: Annotated[TenantContext, Depends(require_permission("service.request:read"))],
    db: Annotated[Session, Depends(get_db)],
):
    return APIResponse(message="OK", data=CustomerPrioritySlaService(db).get(ctx, row_id))


@customer_priority_slas_router.post("", response_model=APIResponse[CustomerPrioritySlaResponse])
def create_customer_priority_sla(
    body: CustomerPrioritySlaCreate,
    ctx: Annotated[TenantContext, Depends(require_permission("service.request:approve"))],
    db: Annotated[Session, Depends(get_db)],
):
    data = CustomerPrioritySlaService(db).create(ctx, **body.model_dump(exclude_none=True))
    db.commit()
    return APIResponse(message="Customer priority SLA created", data=data)


@customer_priority_slas_router.patch("/{row_id}", response_model=APIResponse[CustomerPrioritySlaResponse])
def update_customer_priority_sla(
    row_id: UUID,
    body: CustomerPrioritySlaUpdate,
    ctx: Annotated[TenantContext, Depends(require_permission("service.request:approve"))],
    db: Annotated[Session, Depends(get_db)],
):
    data = CustomerPrioritySlaService(db).update(ctx, row_id, **body.model_dump(exclude_none=True))
    db.commit()
    return APIResponse(message="Customer priority SLA updated", data=data)


@customer_priority_slas_router.delete("/{row_id}", response_model=APIResponse[dict])
def delete_customer_priority_sla(
    row_id: UUID,
    ctx: Annotated[TenantContext, Depends(require_permission("service.request:approve"))],
    db: Annotated[Session, Depends(get_db)],
):
    CustomerPrioritySlaService(db).delete(ctx, row_id)
    db.commit()
    return APIResponse(message="Customer priority SLA deleted", data={"id": str(row_id)})