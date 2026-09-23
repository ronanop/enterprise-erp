"""IT Asset Type master API."""

from typing import Annotated
from uuid import UUID

from fastapi import APIRouter, Depends, Query
from pydantic import BaseModel, ConfigDict
from sqlalchemy.orm import Session

from database.session import get_db
from modules.asset.service.asset_type_service import AssetTypeService
from modules.asset.service.site_access import require_site_admin, require_site_read
from modules.foundation.domain.value_objects import TenantContext
from shared.schemas import APIResponse

asset_types_router = APIRouter(prefix="/asset-types", tags=["Asset — AssetType"])


class AssetTypeCreate(BaseModel):
    company_id: UUID | None = None
    name: str
    requires_hardware_config: bool = False
    eligible_as_component: bool = True
    description: str | None = None
    active: bool = True


class AssetTypeUpdate(BaseModel):
    name: str | None = None
    requires_hardware_config: bool | None = None
    eligible_as_component: bool | None = None
    description: str | None = None
    active: bool | None = None
    version: int | None = None


class AssetTypeResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: UUID
    name: str
    active: bool
    requires_hardware_config: bool
    eligible_as_component: bool = True
    description: str | None
    company_id: UUID
    version: int


@asset_types_router.get("", response_model=APIResponse[list[AssetTypeResponse]])
def list_asset_types(
    ctx: Annotated[TenantContext, Depends(require_site_read("asset.type:read"))],
    db: Annotated[Session, Depends(get_db)],
    company_id: UUID | None = None,
    active: bool | None = Query(default=None),
    search: str | None = None,
):
    rows = AssetTypeService(db).list(
        ctx, company_id=company_id, active=active, search=search
    )
    return APIResponse(message="OK", data=[AssetTypeResponse(**r) for r in rows])


@asset_types_router.get("/{row_id}", response_model=APIResponse[AssetTypeResponse])
def get_asset_type(
    row_id: UUID,
    ctx: Annotated[TenantContext, Depends(require_site_read("asset.type:read"))],
    db: Annotated[Session, Depends(get_db)],
):
    return APIResponse(message="OK", data=AssetTypeResponse(**AssetTypeService(db).get(ctx, row_id)))


@asset_types_router.post(
    "",
    response_model=APIResponse[AssetTypeResponse],
    status_code=201,
)
def create_asset_type(
    body: AssetTypeCreate,
    ctx: Annotated[TenantContext, Depends(require_site_admin("asset.type:create"))],
    db: Annotated[Session, Depends(get_db)],
):
    row = AssetTypeService(db).create(ctx, **body.model_dump())
    db.commit()
    return APIResponse(message="Created", data=AssetTypeResponse(**row))


@asset_types_router.patch(
    "/{row_id}",
    response_model=APIResponse[AssetTypeResponse],
)
def update_asset_type(
    row_id: UUID,
    body: AssetTypeUpdate,
    ctx: Annotated[TenantContext, Depends(require_site_admin("asset.type:update"))],
    db: Annotated[Session, Depends(get_db)],
):
    row = AssetTypeService(db).update(
        ctx, row_id, **body.model_dump(exclude_unset=True)
    )
    db.commit()
    return APIResponse(message="Updated", data=AssetTypeResponse(**row))


@asset_types_router.post(
    "/{row_id}/deactivate",
    response_model=APIResponse[AssetTypeResponse],
)
def deactivate_asset_type(
    row_id: UUID,
    ctx: Annotated[TenantContext, Depends(require_site_admin("asset.type:update"))],
    db: Annotated[Session, Depends(get_db)],
):
    row = AssetTypeService(db).deactivate(ctx, row_id)
    db.commit()
    return APIResponse(message="Deactivated", data=AssetTypeResponse(**row))


@asset_types_router.post(
    "/{row_id}/reactivate",
    response_model=APIResponse[AssetTypeResponse],
)
def reactivate_asset_type(
    row_id: UUID,
    ctx: Annotated[TenantContext, Depends(require_site_admin("asset.type:update"))],
    db: Annotated[Session, Depends(get_db)],
):
    row = AssetTypeService(db).reactivate(ctx, row_id)
    db.commit()
    return APIResponse(message="Reactivated", data=AssetTypeResponse(**row))
