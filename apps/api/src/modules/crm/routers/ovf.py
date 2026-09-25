"""CRM OVF (Order Value Form) REST endpoints (rules #4, #7, #8)."""

from typing import Annotated
from uuid import UUID

from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session

from modules.crm.dependencies import PaginationParams, extract_update_fields, get_db, get_pagination, paginate
from modules.crm.schemas import (
    OvfCreate,
    OvfDealWonRequest,
    OvfInvoiceStatusResponse,
    OvfInvoiceSubmissionRequest,
    OvfLineCreate,
    OvfLineResponse,
    OvfLineUpdate,
    OvfPaymentUpdateRequest,
    OvfResponse,
    OvfScmSavingsResponse,
    OvfSendForApprovalRequest,
    OvfUpdate,
)
from modules.crm.service import OvfService
from modules.foundation.dependencies import require_permission
from modules.foundation.domain.value_objects import TenantContext
from shared.schemas import APIResponse

ovf_router = APIRouter(prefix="/ovf", tags=["CRM - OVF"])


@ovf_router.get("", response_model=APIResponse[list[OvfResponse]])
def list_ovfs(
    ctx: Annotated[TenantContext, Depends(require_permission("crm.ovf:read"))],
    db: Annotated[Session, Depends(get_db)],
    pagination: Annotated[PaginationParams, Depends(get_pagination)],
    company_id: UUID | None = None,
    opportunity_id: UUID | None = None,
):
    rows = OvfService(db).list(ctx, company_id, opportunity_id)
    return APIResponse(message="OK", data=paginate(rows, pagination))


@ovf_router.post("", response_model=APIResponse[OvfResponse])
def create_ovf(
    body: OvfCreate,
    ctx: Annotated[TenantContext, Depends(require_permission("crm.ovf:create"))],
    db: Annotated[Session, Depends(get_db)],
):
    return APIResponse(message="OK", data=OvfService(db).create(ctx, **body.model_dump()))


@ovf_router.get("/{ovf_id}", response_model=APIResponse[OvfResponse])
def get_ovf(
    ovf_id: UUID,
    ctx: Annotated[TenantContext, Depends(require_permission("crm.ovf:read"))],
    db: Annotated[Session, Depends(get_db)],
):
    svc = OvfService(db)
    ovf = svc.get(ctx, ovf_id)
    resp = OvfResponse.model_validate(ovf)
    if resp.po_date is None:
        resolved = svc.resolve_customer_po_display_date(ctx, ovf)
        if resolved is not None:
            resp = resp.model_copy(update={"po_date": resolved})
    return APIResponse(message="OK", data=resp)


@ovf_router.patch("/{ovf_id}", response_model=APIResponse[OvfResponse])
def update_ovf(
    ovf_id: UUID,
    body: OvfUpdate,
    ctx: Annotated[TenantContext, Depends(require_permission("crm.ovf:update"))],
    db: Annotated[Session, Depends(get_db)],
):
    return APIResponse(message="OK", data=OvfService(db).update(ctx, ovf_id, **extract_update_fields(body)))


@ovf_router.delete("/{ovf_id}", response_model=APIResponse[dict[str, str]])
def delete_ovf(
    ovf_id: UUID,
    ctx: Annotated[TenantContext, Depends(require_permission("crm.ovf:update"))],
    db: Annotated[Session, Depends(get_db)],
):
    OvfService(db).delete(ctx, ovf_id)
    return APIResponse(message="OK", data={"id": str(ovf_id)})


@ovf_router.get("/{ovf_id}/lines", response_model=APIResponse[list[OvfLineResponse]])
def list_ovf_lines(
    ovf_id: UUID,
    ctx: Annotated[TenantContext, Depends(require_permission("crm.ovf:read"))],
    db: Annotated[Session, Depends(get_db)],
):
    return APIResponse(message="OK", data=OvfService(db).list_lines(ctx, ovf_id))


@ovf_router.post("/{ovf_id}/lines", response_model=APIResponse[OvfLineResponse])
def add_ovf_line(
    ovf_id: UUID,
    body: OvfLineCreate,
    ctx: Annotated[TenantContext, Depends(require_permission("crm.ovf:update"))],
    db: Annotated[Session, Depends(get_db)],
):
    return APIResponse(message="OK", data=OvfService(db).add_line(ctx, ovf_id, **body.model_dump()))


@ovf_router.patch("/lines/{line_id}", response_model=APIResponse[OvfLineResponse])
def update_ovf_line(
    line_id: UUID,
    body: OvfLineUpdate,
    ctx: Annotated[TenantContext, Depends(require_permission("crm.ovf:update"))],
    db: Annotated[Session, Depends(get_db)],
):
    return APIResponse(
        message="OK",
        data=OvfService(db).update_line(ctx, line_id, **extract_update_fields(body)),
    )


@ovf_router.get("/{ovf_id}/scm-savings", response_model=APIResponse[OvfScmSavingsResponse])
def get_ovf_scm_savings(
    ovf_id: UUID,
    ctx: Annotated[TenantContext, Depends(require_permission("crm.ovf:read"))],
    db: Annotated[Session, Depends(get_db)],
):
    """Management / SCM only - the saving never reaches the sales incentive."""
    return APIResponse(message="OK", data=OvfService(db).get_scm_savings(ctx, ovf_id))


@ovf_router.get("/{ovf_id}/invoice-status", response_model=APIResponse[OvfInvoiceStatusResponse])
def get_ovf_invoice_status(
    ovf_id: UUID,
    ctx: Annotated[TenantContext, Depends(require_permission("crm.ovf:read"))],
    db: Annotated[Session, Depends(get_db)],
):
    return APIResponse(message="OK", data=OvfService(db).get_invoice_status(ctx, ovf_id))


@ovf_router.post(
    "/{ovf_id}/invoice-submission",
    response_model=APIResponse[OvfInvoiceStatusResponse],
)
def record_ovf_invoice_submission(
    ovf_id: UUID,
    body: OvfInvoiceSubmissionRequest,
    ctx: Annotated[TenantContext, Depends(require_permission("crm.ovf:update"))],
    db: Annotated[Session, Depends(get_db)],
):
    return APIResponse(
        message="Invoice submission recorded",
        data=OvfService(db).record_invoice_submission(ctx, ovf_id, **body.model_dump()),
    )


@ovf_router.patch("/{ovf_id}/payment", response_model=APIResponse[OvfInvoiceStatusResponse])
def update_ovf_payment(
    ovf_id: UUID,
    body: OvfPaymentUpdateRequest,
    ctx: Annotated[TenantContext, Depends(require_permission("crm.ovf:update"))],
    db: Annotated[Session, Depends(get_db)],
):
    return APIResponse(
        message="Payment tracking updated",
        data=OvfService(db).update_payment(ctx, ovf_id, **body.model_dump()),
    )


@ovf_router.post("/{ovf_id}/send-for-approval", response_model=APIResponse[OvfResponse])
def send_ovf_for_approval(
    ovf_id: UUID,
    body: OvfSendForApprovalRequest,
    ctx: Annotated[TenantContext, Depends(require_permission("crm.ovf:update"))],
    db: Annotated[Session, Depends(get_db)],
):
    return APIResponse(message="OK", data=OvfService(db).send_for_approval(ctx, ovf_id, **body.model_dump()))


@ovf_router.post("/{ovf_id}/request-freight", response_model=APIResponse[OvfResponse])
def request_ovf_freight(
    ovf_id: UUID,
    ctx: Annotated[TenantContext, Depends(require_permission("crm.ovf:update"))],
    db: Annotated[Session, Depends(get_db)],
):
    return APIResponse(
        message="Freight requested from SCM",
        data=OvfService(db).request_freight_from_scm(ctx, ovf_id),
    )


@ovf_router.post("/{ovf_id}/share-to-scm", response_model=APIResponse[OvfResponse])
def share_ovf_to_scm(
    ovf_id: UUID,
    ctx: Annotated[TenantContext, Depends(require_permission("crm.ovf:share_scm"))],
    db: Annotated[Session, Depends(get_db)],
):
    return APIResponse(message="OK", data=OvfService(db).share_to_scm(ctx, ovf_id))


@ovf_router.post("/{ovf_id}/deal-won", response_model=APIResponse[OvfResponse])
def mark_ovf_deal_won(
    ovf_id: UUID,
    body: OvfDealWonRequest,
    ctx: Annotated[TenantContext, Depends(require_permission("crm.ovf:deal_won"))],
    db: Annotated[Session, Depends(get_db)],
):
    return APIResponse(
        message="OK",
        data=OvfService(db).mark_deal_won(ctx, ovf_id, deal_won_amount=body.deal_won_amount),
    )
