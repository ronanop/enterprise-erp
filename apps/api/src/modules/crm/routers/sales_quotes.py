"""CRM sales Quote REST endpoints (rules #3, #6, #8)."""

from typing import Annotated
from uuid import UUID

from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session

from modules.crm.dependencies import (
    PaginationParams,
    extract_update_fields,
    get_db,
    get_pagination,
    paginate,
)
from modules.crm.schemas import (
    QuoteActionRequest,
    QuoteCreate,
    QuoteLineCreate,
    QuoteLineResponse,
    QuoteLineUpdate,
    QuoteMarginSummaryResponse,
    QuoteResponse,
    QuoteSendForApprovalRequest,
    QuoteUpdate,
)
from modules.crm.service import QuoteService
from modules.foundation.dependencies import require_permission
from modules.foundation.domain.value_objects import TenantContext
from shared.schemas import APIResponse

quotes_router = APIRouter(prefix="/quotes", tags=["CRM - Sales Quotes"])


@quotes_router.get("", response_model=APIResponse[list[QuoteResponse]])
def list_quotes(
    ctx: Annotated[TenantContext, Depends(require_permission("crm.quote:read"))],
    db: Annotated[Session, Depends(get_db)],
    pagination: Annotated[PaginationParams, Depends(get_pagination)],
    company_id: UUID | None = None,
    opportunity_id: UUID | None = None,
):
    rows = QuoteService(db).list(ctx, company_id, opportunity_id)
    return APIResponse(message="OK", data=paginate(rows, pagination))


@quotes_router.post("", response_model=APIResponse[QuoteResponse])
def create_quote(
    body: QuoteCreate,
    ctx: Annotated[TenantContext, Depends(require_permission("crm.quote:create"))],
    db: Annotated[Session, Depends(get_db)],
):
    return APIResponse(message="OK", data=QuoteService(db).create(ctx, **body.model_dump()))


@quotes_router.get("/{quote_id}", response_model=APIResponse[QuoteResponse])
def get_quote(
    quote_id: UUID,
    ctx: Annotated[TenantContext, Depends(require_permission("crm.quote:read"))],
    db: Annotated[Session, Depends(get_db)],
):
    return APIResponse(message="OK", data=QuoteService(db).get(ctx, quote_id))


@quotes_router.patch("/{quote_id}", response_model=APIResponse[QuoteResponse])
def update_quote(
    quote_id: UUID,
    body: QuoteUpdate,
    ctx: Annotated[TenantContext, Depends(require_permission("crm.quote:update"))],
    db: Annotated[Session, Depends(get_db)],
):
    return APIResponse(message="OK", data=QuoteService(db).update(ctx, quote_id, **extract_update_fields(body)))


@quotes_router.get("/{quote_id}/lines", response_model=APIResponse[list[QuoteLineResponse]])
def list_quote_lines(
    quote_id: UUID,
    ctx: Annotated[TenantContext, Depends(require_permission("crm.quote:read"))],
    db: Annotated[Session, Depends(get_db)],
):
    return APIResponse(message="OK", data=QuoteService(db).list_lines(ctx, quote_id))


@quotes_router.post("/{quote_id}/lines", response_model=APIResponse[QuoteLineResponse])
def add_quote_line(
    quote_id: UUID,
    body: QuoteLineCreate,
    ctx: Annotated[TenantContext, Depends(require_permission("crm.quote:update"))],
    db: Annotated[Session, Depends(get_db)],
):
    return APIResponse(message="OK", data=QuoteService(db).add_line(ctx, quote_id, **body.model_dump()))


@quotes_router.patch("/lines/{line_id}", response_model=APIResponse[QuoteLineResponse])
def update_quote_line(
    line_id: UUID,
    body: QuoteLineUpdate,
    ctx: Annotated[TenantContext, Depends(require_permission("crm.quote:update"))],
    db: Annotated[Session, Depends(get_db)],
):
    return APIResponse(
        message="OK",
        data=QuoteService(db).update_line(ctx, line_id, **extract_update_fields(body)),
    )


@quotes_router.delete("/lines/{line_id}", response_model=APIResponse[None])
def delete_quote_line(
    line_id: UUID,
    ctx: Annotated[TenantContext, Depends(require_permission("crm.quote:update"))],
    db: Annotated[Session, Depends(get_db)],
):
    QuoteService(db).delete_line(ctx, line_id)
    return APIResponse(message="OK", data=None)


@quotes_router.get("/{quote_id}/margin", response_model=APIResponse[QuoteMarginSummaryResponse])
def get_quote_margin(
    quote_id: UUID,
    ctx: Annotated[TenantContext, Depends(require_permission("crm.quote:read"))],
    db: Annotated[Session, Depends(get_db)],
):
    return APIResponse(message="OK", data=QuoteService(db).margin_summary(ctx, quote_id))


@quotes_router.post("/{quote_id}/send-for-approval", response_model=APIResponse[QuoteResponse])
def send_quote_for_approval(
    quote_id: UUID,
    body: QuoteSendForApprovalRequest,
    ctx: Annotated[TenantContext, Depends(require_permission("crm.quote:send_approval"))],
    db: Annotated[Session, Depends(get_db)],
):
    return APIResponse(message="OK", data=QuoteService(db).send_for_approval(ctx, quote_id, **body.model_dump()))


@quotes_router.post("/{quote_id}/approve-internally", response_model=APIResponse[QuoteResponse])
def approve_quote_internally(
    quote_id: UUID,
    body: QuoteActionRequest,
    ctx: Annotated[TenantContext, Depends(require_permission("crm.quote:approve"))],
    db: Annotated[Session, Depends(get_db)],
):
    return APIResponse(message="OK", data=QuoteService(db).approve_internally(ctx, quote_id, remark=body.remark))


@quotes_router.post("/{quote_id}/actions/{action}", response_model=APIResponse[QuoteResponse])
def quote_blueprint_action(
    quote_id: UUID,
    action: str,
    body: QuoteActionRequest,
    ctx: Annotated[TenantContext, Depends(require_permission("crm.blueprint:act"))],
    db: Annotated[Session, Depends(get_db)],
):
    payload = body.model_dump(exclude_none=True)
    return APIResponse(message="OK", data=QuoteService(db).apply_blueprint_action(ctx, quote_id, action, payload))
