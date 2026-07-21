"""Vendor comparison routers."""

from typing import Annotated
from uuid import UUID

from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session

from database.session import get_db
from modules.foundation.dependencies import require_permission
from modules.foundation.domain.value_objects import TenantContext
from modules.procurement.schemas import (
    ComparisonResponse,
    ComparisonSelectRequest,
)
from modules.procurement.service.vendor_comparison_service import VendorComparisonService
from shared.schemas import APIResponse

comparisons_router = APIRouter(prefix="/comparisons", tags=["Procurement - Comparisons"])


@comparisons_router.get(
    "",
    response_model=APIResponse[list[ComparisonResponse]],
)
def list_comparisons(
    ctx: Annotated[
        TenantContext, Depends(require_permission("procurement.vendor_quotation:read"))
    ],
    db: Annotated[Session, Depends(get_db)],
    company_id: UUID | None = None,
) -> APIResponse[list[ComparisonResponse]]:
    rows = VendorComparisonService(db).list(ctx, company_id)
    return APIResponse(
        message="Vendor comparisons retrieved",
        data=[ComparisonResponse.model_validate(row) for row in rows],
    )


@comparisons_router.post(
    "/rfqs/{rfq_id}/run",
    response_model=APIResponse[ComparisonResponse],
)
def run_comparison(
    rfq_id: UUID,
    ctx: Annotated[
        TenantContext, Depends(require_permission("procurement.vendor_quotation:select"))
    ],
    db: Annotated[Session, Depends(get_db)],
) -> APIResponse[ComparisonResponse]:
    row = VendorComparisonService(db).run_comparison(ctx, rfq_id)
    db.commit()
    return APIResponse(
        message="Vendor comparison completed",
        data=ComparisonResponse.model_validate(row),
    )


@comparisons_router.get(
    "/rfqs/{rfq_id}",
    response_model=APIResponse[ComparisonResponse],
)
def get_comparison(
    rfq_id: UUID,
    ctx: Annotated[
        TenantContext, Depends(require_permission("procurement.vendor_quotation:read"))
    ],
    db: Annotated[Session, Depends(get_db)],
) -> APIResponse[ComparisonResponse]:
    row = VendorComparisonService(db).get_by_rfq(ctx, rfq_id)
    return APIResponse(
        message="Vendor comparison retrieved",
        data=ComparisonResponse.model_validate(row),
    )


@comparisons_router.post(
    "/rfqs/{rfq_id}/select",
    response_model=APIResponse[ComparisonResponse],
)
def select_quotation(
    rfq_id: UUID,
    body: ComparisonSelectRequest,
    ctx: Annotated[
        TenantContext, Depends(require_permission("procurement.vendor_quotation:select"))
    ],
    db: Annotated[Session, Depends(get_db)],
) -> APIResponse[ComparisonResponse]:
    row = VendorComparisonService(db).select_quotation(
        ctx, rfq_id, body.quotation_id
    )
    db.commit()
    return APIResponse(
        message="Vendor quotation selected",
        data=ComparisonResponse.model_validate(row),
    )
