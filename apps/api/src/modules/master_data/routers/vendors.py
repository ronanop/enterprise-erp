"""Vendor router."""

from typing import Annotated
from uuid import UUID

from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session

from database.session import get_db
from modules.foundation.dependencies import require_any_permission, require_permission
from modules.foundation.domain.value_objects import TenantContext
from modules.master_data.dependencies import (
    PaginationParams,
    extract_update_fields,
    get_pagination,
    paginate,
)
from modules.master_data.schemas import VendorCreateRequest, VendorResponse, VendorUpdateRequest
from modules.master_data.service.vendor_service import VendorService
from shared.schemas import APIResponse

router = APIRouter(prefix="/vendors", tags=["Master Data - Vendors"])


@router.get("", response_model=APIResponse[list[VendorResponse]])
def list_vendors(
    ctx: Annotated[
        TenantContext,
        Depends(require_any_permission("master.vendor:read", "procurement.order:read")),
    ],
    db: Annotated[Session, Depends(get_db)],
    pagination: Annotated[PaginationParams, Depends(get_pagination)],
    company_id: UUID | None = None,
    branch_id: UUID | None = None,
) -> APIResponse[list[VendorResponse]]:
    vendors = VendorService(db).list_vendors(ctx, company_id=company_id, branch_id=branch_id)
    page = paginate(vendors, pagination)
    return APIResponse(
        message="Vendors retrieved",
        data=[VendorResponse(**v.__dict__) for v in page],
    )


@router.post("", response_model=APIResponse[VendorResponse])
def create_vendor(
    body: VendorCreateRequest,
    ctx: Annotated[
        TenantContext,
        Depends(require_any_permission("master.vendor:create", "procurement.order:create")),
    ],
    db: Annotated[Session, Depends(get_db)],
) -> APIResponse[VendorResponse]:
    vendor = VendorService(db).create_vendor(ctx, **body.model_dump())
    db.commit()
    return APIResponse(message="Vendor created", data=VendorResponse(**vendor.__dict__))


@router.get("/{vendor_id}", response_model=APIResponse[VendorResponse])
def get_vendor(
    vendor_id: UUID,
    ctx: Annotated[
        TenantContext,
        Depends(require_any_permission("master.vendor:read", "procurement.order:read")),
    ],
    db: Annotated[Session, Depends(get_db)],
) -> APIResponse[VendorResponse]:
    vendor = VendorService(db).get_vendor(ctx, vendor_id)
    return APIResponse(message="Vendor retrieved", data=VendorResponse(**vendor.__dict__))


@router.put("/{vendor_id}", response_model=APIResponse[VendorResponse])
def update_vendor(
    vendor_id: UUID,
    body: VendorUpdateRequest,
    ctx: Annotated[
        TenantContext,
        Depends(require_any_permission("master.vendor:update", "procurement.order:update")),
    ],
    db: Annotated[Session, Depends(get_db)],
) -> APIResponse[VendorResponse]:
    vendor = VendorService(db).update_vendor(ctx, vendor_id, **extract_update_fields(body))
    db.commit()
    return APIResponse(message="Vendor updated", data=VendorResponse(**vendor.__dict__))


@router.delete("/{vendor_id}", response_model=APIResponse[None])
def delete_vendor(
    vendor_id: UUID,
    ctx: Annotated[TenantContext, Depends(require_permission("master.vendor:delete"))],
    db: Annotated[Session, Depends(get_db)],
) -> APIResponse[None]:
    VendorService(db).delete_vendor(ctx, vendor_id)
    db.commit()
    return APIResponse(message="Vendor deleted", data=None)
