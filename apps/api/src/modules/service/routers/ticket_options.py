"""Routers for Mode / Category ticket option masters."""

from typing import Annotated
from uuid import UUID

from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session

from modules.service.dependencies import TenantContext, get_db, require_permission
from modules.service.service.ticket_option_service import TicketOptionService
from modules.service.service_request_ticket_schemas import (
    TicketOptionCreate,
    TicketOptionResponse,
    TicketOptionUpdate,
)
from shared.schemas import APIResponse

ticket_options_router = APIRouter(
    prefix="/ticket-options",
    tags=["Service — Ticket Options"],
)


@ticket_options_router.get("", response_model=APIResponse[list[TicketOptionResponse]])
def list_ticket_options(
    ctx: Annotated[TenantContext, Depends(require_permission("service.request:read"))],
    db: Annotated[Session, Depends(get_db)],
    option_type: str | None = None,
    company_id: UUID | None = None,
    active_only: bool = True,
):
    items = TicketOptionService(db).list(
        ctx, option_type=option_type, company_id=company_id, active_only=active_only
    )
    return APIResponse(message="OK", data=items)


@ticket_options_router.post("", response_model=APIResponse[TicketOptionResponse])
def create_ticket_option(
    body: TicketOptionCreate,
    ctx: Annotated[TenantContext, Depends(require_permission("service.category:create"))],
    db: Annotated[Session, Depends(get_db)],
):
    data = TicketOptionService(db).create(ctx, **body.model_dump(exclude_none=True))
    db.commit()
    return APIResponse(message="Created", data=data)


@ticket_options_router.patch("/{row_id}", response_model=APIResponse[TicketOptionResponse])
def update_ticket_option(
    row_id: UUID,
    body: TicketOptionUpdate,
    ctx: Annotated[TenantContext, Depends(require_permission("service.category:update"))],
    db: Annotated[Session, Depends(get_db)],
):
    data = TicketOptionService(db).update(ctx, row_id, **body.model_dump(exclude_none=True))
    db.commit()
    return APIResponse(message="Updated", data=data)
