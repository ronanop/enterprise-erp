"""SCM workspace routers — OVF queue, create vendor PO, GRN line updates."""

from typing import Annotated
from uuid import UUID

from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session

from database.session import get_db
from modules.foundation.dependencies import require_permission
from modules.foundation.domain.value_objects import TenantContext
from modules.procurement.schemas import (
    OrderResponse,
    ScmCreatePoFromOvfRequest,
    ScmLineReceiptUpdateRequest,
    ScmOvfPreviewResponse,
    ScmQueueItemResponse,
    ScmVendorPoResponse,
)
from modules.procurement.service.scm_handoff_service import ScmHandoffService
from shared.schemas import APIResponse

scm_router = APIRouter(prefix="/scm", tags=["Procurement - SCM"])


@scm_router.get("/queue", response_model=APIResponse[list[ScmQueueItemResponse]])
def list_scm_queue(
    ctx: Annotated[TenantContext, Depends(require_permission("procurement.order:read"))],
    db: Annotated[Session, Depends(get_db)],
    company_id: UUID | None = None,
) -> APIResponse[list[ScmQueueItemResponse]]:
    rows = ScmHandoffService(db).list_scm_queue(ctx, company_id)
    return APIResponse(
        message="SCM queue retrieved",
        data=[ScmQueueItemResponse.model_validate(r) for r in rows],
    )


@scm_router.get("/ovf/{ovf_id}", response_model=APIResponse[ScmOvfPreviewResponse])
def get_scm_ovf_preview(
    ovf_id: UUID,
    ctx: Annotated[TenantContext, Depends(require_permission("procurement.order:read"))],
    db: Annotated[Session, Depends(get_db)],
) -> APIResponse[ScmOvfPreviewResponse]:
    row = ScmHandoffService(db).get_ovf_preview(ctx, ovf_id)
    return APIResponse(
        message="OVF preview retrieved",
        data=ScmOvfPreviewResponse.model_validate(row),
    )


@scm_router.post("/ovf/{ovf_id}/purchase-orders", response_model=APIResponse[OrderResponse])
def create_po_from_ovf(
    ovf_id: UUID,
    body: ScmCreatePoFromOvfRequest,
    ctx: Annotated[TenantContext, Depends(require_permission("procurement.order:create"))],
    db: Annotated[Session, Depends(get_db)],
) -> APIResponse[OrderResponse]:
    row = ScmHandoffService(db).create_po_from_ovf(ctx, ovf_id=ovf_id, **body.model_dump())
    db.commit()
    return APIResponse(
        message="Vendor purchase order created from OVF",
        data=OrderResponse.model_validate(row),
    )


@scm_router.post("/orders/{order_id}/finalize", response_model=APIResponse[OrderResponse])
def finalize_scm_order(
    order_id: UUID,
    ctx: Annotated[TenantContext, Depends(require_permission("procurement.order:send"))],
    db: Annotated[Session, Depends(get_db)],
) -> APIResponse[OrderResponse]:
    row = ScmHandoffService(db).finalize_scm_po(ctx, order_id)
    db.commit()
    return APIResponse(message="SCM purchase order finalized", data=OrderResponse.model_validate(row))


@scm_router.get("/vendor-pos", response_model=APIResponse[list[ScmVendorPoResponse]])
def list_vendor_pos(
    ctx: Annotated[TenantContext, Depends(require_permission("procurement.order:read"))],
    db: Annotated[Session, Depends(get_db)],
    company_id: UUID | None = None,
) -> APIResponse[list[ScmVendorPoResponse]]:
    rows = ScmHandoffService(db).list_vendor_pos(ctx, company_id)
    return APIResponse(
        message="Vendor POs retrieved",
        data=[ScmVendorPoResponse.model_validate(r) for r in rows],
    )


@scm_router.patch(
    "/orders/{order_id}/lines/{line_id}/receipt",
    response_model=APIResponse[OrderResponse],
)
def update_line_receipt(
    order_id: UUID,
    line_id: UUID,
    body: ScmLineReceiptUpdateRequest,
    ctx: Annotated[TenantContext, Depends(require_permission("procurement.grn:update"))],
    db: Annotated[Session, Depends(get_db)],
) -> APIResponse[OrderResponse]:
    row = ScmHandoffService(db).update_line_receipt(
        ctx,
        order_id,
        line_id,
        quantity_received=body.quantity_received,
        grn_status=body.grn_status,
    )
    db.commit()
    return APIResponse(message="GRN line updated", data=OrderResponse.model_validate(row))
