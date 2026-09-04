"""CRM OEM partner master REST endpoints."""

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
from modules.crm.schemas import OemCreate, OemResponse, OemUpdate
from modules.crm.service.oem_service import OemService
from modules.foundation.dependencies import require_permission
from modules.foundation.domain.value_objects import TenantContext
from shared.schemas import APIResponse

oems_router = APIRouter(prefix="/oems", tags=["CRM - OEMs"])


@oems_router.get("", response_model=APIResponse[list[OemResponse]])
def list_oems(
    ctx: Annotated[TenantContext, Depends(require_permission("crm.lead:read"))],
    db: Annotated[Session, Depends(get_db)],
    pagination: Annotated[PaginationParams, Depends(get_pagination)],
    company_id: UUID | None = None,
):
    rows = OemService(db).list(ctx, company_id)
    return APIResponse(message="OK", data=paginate(rows, pagination))


@oems_router.post("", response_model=APIResponse[OemResponse])
def create_oem(
    body: OemCreate,
    ctx: Annotated[TenantContext, Depends(require_permission("crm.lead:create"))],
    db: Annotated[Session, Depends(get_db)],
):
    return APIResponse(message="OK", data=OemService(db).create(ctx, **body.model_dump()))


@oems_router.get("/{oem_id}", response_model=APIResponse[OemResponse])
def get_oem(
    oem_id: UUID,
    ctx: Annotated[TenantContext, Depends(require_permission("crm.lead:read"))],
    db: Annotated[Session, Depends(get_db)],
):
    return APIResponse(message="OK", data=OemService(db).get(ctx, oem_id))


@oems_router.patch("/{oem_id}", response_model=APIResponse[OemResponse])
def update_oem(
    oem_id: UUID,
    body: OemUpdate,
    ctx: Annotated[TenantContext, Depends(require_permission("crm.lead:update"))],
    db: Annotated[Session, Depends(get_db)],
):
    return APIResponse(
        message="OK",
        data=OemService(db).update(ctx, oem_id, **extract_update_fields(body)),
    )
