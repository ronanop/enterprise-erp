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
    QuoteRevisionPrintPayload,
    QuoteRevisionRow,
    QuoteSendForApprovalRequest,
    QuoteSplitBalanceRow,
    QuoteSplitRequest,
    QuoteUpdate,
    VendorQuoteExtractRequest,
    VendorQuoteExtractResponse,
)
from modules.crm.domain.quote_terms import DEFAULT_GENERAL_TERMS
from modules.crm.service import QuoteService
from modules.crm.service.vendor_quote_extract_service import extract_vendor_quote
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


@quotes_router.get("/next-quote-number", response_model=APIResponse[dict[str, str]])
def next_quote_number(
    ctx: Annotated[TenantContext, Depends(require_permission("crm.quote:read"))],
    db: Annotated[Session, Depends(get_db)],
    company_id: UUID | None = None,
    opportunity_id: UUID | None = None,
):
    number = QuoteService(db).peek_next_quote_no(ctx, company_id, opportunity_id)
    return APIResponse(message="OK", data={"quote_no": number})


@quotes_router.get("/default-terms", response_model=APIResponse[dict[str, str]])
def default_quote_terms(
    ctx: Annotated[TenantContext, Depends(require_permission("crm.quote:read"))],
):
    return APIResponse(message="OK", data={"terms": DEFAULT_GENERAL_TERMS})


@quotes_router.post("/extract-vendor-lines", response_model=APIResponse[VendorQuoteExtractResponse])
def extract_vendor_quote_lines(
    body: VendorQuoteExtractRequest,
    ctx: Annotated[TenantContext, Depends(require_permission("crm.quote:create"))],
):
    """Line items read from a vendor / OEM quote file - review and edit before saving."""
    data = extract_vendor_quote(body.file_name, body.content_base64)
    return APIResponse(message=f"{len(data['lines'])} line(s) read from the vendor quote", data=data)


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


@quotes_router.delete("/{quote_id}", response_model=APIResponse[dict[str, str]])
def delete_quote(
    quote_id: UUID,
    ctx: Annotated[TenantContext, Depends(require_permission("crm.quote:update"))],
    db: Annotated[Session, Depends(get_db)],
):
    QuoteService(db).delete(ctx, quote_id)
    return APIResponse(message="OK", data={"id": str(quote_id)})


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


@quotes_router.get("/{quote_id}/split-balance", response_model=APIResponse[list[QuoteSplitBalanceRow]])
def get_quote_split_balance(
    quote_id: UUID,
    ctx: Annotated[TenantContext, Depends(require_permission("crm.quote:read"))],
    db: Annotated[Session, Depends(get_db)],
):
    return APIResponse(message="OK", data=QuoteService(db).split_balance(ctx, quote_id))


@quotes_router.post("/{quote_id}/split", response_model=APIResponse[list[QuoteResponse]])
def split_quote(
    quote_id: UUID,
    body: QuoteSplitRequest,
    ctx: Annotated[TenantContext, Depends(require_permission("crm.quote:create"))],
    db: Annotated[Session, Depends(get_db)],
):
    """One vendor-backed quote → several customer quotes with quantity drawn down, not cloned."""
    rows = QuoteService(db).split_quote(
        ctx, quote_id, splits=[split.model_dump(exclude_none=True) for split in body.splits]
    )
    return APIResponse(message=f"Quote split into {len(rows)} quotes", data=rows)


@quotes_router.get("/{quote_id}/margin", response_model=APIResponse[QuoteMarginSummaryResponse])
def get_quote_margin(
    quote_id: UUID,
    ctx: Annotated[TenantContext, Depends(require_permission("crm.quote:read"))],
    db: Annotated[Session, Depends(get_db)],
):
    return APIResponse(message="OK", data=QuoteService(db).margin_summary(ctx, quote_id))


@quotes_router.get("/{quote_id}/revisions", response_model=APIResponse[list[QuoteRevisionRow]])
def list_quote_revisions(
    quote_id: UUID,
    ctx: Annotated[TenantContext, Depends(require_permission("crm.quote:read"))],
    db: Annotated[Session, Depends(get_db)],
):
    return APIResponse(message="OK", data=QuoteService(db).list_revisions(ctx, quote_id))


@quotes_router.get(
    "/{quote_id}/revisions/{revision_no}/print-payload",
    response_model=APIResponse[QuoteRevisionPrintPayload],
)
def get_quote_revision_print_payload(
    quote_id: UUID,
    revision_no: int,
    ctx: Annotated[TenantContext, Depends(require_permission("crm.quote:read"))],
    db: Annotated[Session, Depends(get_db)],
):
    return APIResponse(
        message="OK",
        data=QuoteService(db).revision_print_payload(ctx, quote_id, revision_no),
    )


@quotes_router.post(
    "/{quote_id}/revisions/current/discard",
    response_model=APIResponse[QuoteResponse],
)
def discard_current_quote_revision(
    quote_id: UUID,
    ctx: Annotated[TenantContext, Depends(require_permission("crm.quote:update"))],
    db: Annotated[Session, Depends(get_db)],
):
    """Remove the unapproved current revision and restore the prior approved version."""
    return APIResponse(
        message="OK",
        data=QuoteService(db).discard_current_revision(ctx, quote_id),
    )


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
