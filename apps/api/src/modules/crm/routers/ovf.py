"""CRM OVF (Order Value Form) REST endpoints (rules #4, #7, #8)."""

from typing import Annotated
from uuid import UUID

from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session

from modules.crm.dependencies import PaginationParams, extract_update_fields, get_db, get_pagination, paginate
from modules.crm.schemas import (
    OvfCreate,
    OvfDealWonRequest,
    OvfLineCreate,
    OvfLineResponse,
    OvfLineUpdate,
    OvfResponse,
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
    return APIResponse(message="OK", data=OvfService(db).get(ctx, ovf_id))


@ovf_router.patch("/{ovf_id}", response_model=APIResponse[OvfResponse])
def update_ovf(
    ovf_id: UUID,
    body: OvfUpdate,
    ctx: Annotated[TenantContext, Depends(require_permission("crm.ovf:update"))],
    db: Annotated[Session, Depends(get_db)],
):
    return APIResponse(message="OK", data=OvfService(db).update(ctx, ovf_id, **extract_update_fields(body)))


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


@ovf_router.post("/{ovf_id}/send-for-approval", response_model=APIResponse[OvfResponse])
def send_ovf_for_approval(
    ovf_id: UUID,
    body: OvfSendForApprovalRequest,
    ctx: Annotated[TenantContext, Depends(require_permission("crm.ovf:update"))],
    db: Annotated[Session, Depends(get_db)],
):
    return APIResponse(message="OK", data=OvfService(db).send_for_approval(ctx, ovf_id, **body.model_dump()))


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
