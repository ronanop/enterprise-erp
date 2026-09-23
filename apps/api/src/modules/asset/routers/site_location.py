"""IT site Location / Building master API."""

from typing import Annotated
from uuid import UUID

from fastapi import APIRouter, Depends, Query
from pydantic import BaseModel, ConfigDict
from sqlalchemy.orm import Session

from database.session import get_db
from modules.asset.service.site_access import require_site_admin, require_site_read
from modules.asset.service.site_location_service import SiteLocationService
from modules.foundation.domain.value_objects import TenantContext
from shared.schemas import APIResponse

site_locations_router = APIRouter(prefix="/site-locations", tags=["Asset — Site Locations"])
site_buildings_router = APIRouter(prefix="/site-buildings", tags=["Asset — Site Buildings"])


class SiteLocationCreate(BaseModel):
    company_id: UUID | None = None
    name: str
    is_head_office: bool = False
    org_location_id: UUID | None = None


class SiteLocationUpdate(BaseModel):
    name: str | None = None
    is_head_office: bool | None = None
    org_location_id: UUID | None = None
    version: int | None = None


class SiteLocationResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: UUID
    name: str
    is_head_office: bool
    org_location_id: UUID | None
    company_id: UUID
    version: int


class SiteBuildingCreate(BaseModel):
    company_id: UUID | None = None
    location_id: UUID
    name: str


class SiteBuildingUpdate(BaseModel):
    name: str | None = None
    version: int | None = None


class SiteBuildingResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: UUID
    location_id: UUID
    name: str
    company_id: UUID
    version: int


@site_locations_router.get("", response_model=APIResponse[list[SiteLocationResponse]])
def list_site_locations(
    ctx: Annotated[TenantContext, Depends(require_site_read())],
    db: Annotated[Session, Depends(get_db)],
    company_id: UUID | None = None,
    search: str | None = None,
):
    rows = SiteLocationService(db).list_locations(ctx, company_id=company_id, search=search)
    return APIResponse(message="OK", data=[SiteLocationResponse(**r) for r in rows])


@site_locations_router.post(
    "",
    response_model=APIResponse[SiteLocationResponse],
    status_code=201,
)
def create_site_location(
    body: SiteLocationCreate,
    ctx: Annotated[TenantContext, Depends(require_site_admin("asset.site:create"))],
    db: Annotated[Session, Depends(get_db)],
):
    row = SiteLocationService(db).create_location(ctx, **body.model_dump())
    db.commit()
    return APIResponse(message="Created", data=SiteLocationResponse(**row))


@site_locations_router.patch(
    "/{row_id}",
    response_model=APIResponse[SiteLocationResponse],
)
def update_site_location(
    row_id: UUID,
    body: SiteLocationUpdate,
    ctx: Annotated[TenantContext, Depends(require_site_admin("asset.site:update"))],
    db: Annotated[Session, Depends(get_db)],
):
    row = SiteLocationService(db).update_location(
        ctx, row_id, **body.model_dump(exclude_unset=True)
    )
    db.commit()
    return APIResponse(message="Updated", data=SiteLocationResponse(**row))


@site_locations_router.post("/{row_id}/deactivate", response_model=APIResponse[None])
def deactivate_site_location(
    row_id: UUID,
    ctx: Annotated[TenantContext, Depends(require_site_admin("asset.site:update"))],
    db: Annotated[Session, Depends(get_db)],
):
    SiteLocationService(db).deactivate_location(ctx, row_id)
    db.commit()
    return APIResponse(message="Removed", data=None)


@site_buildings_router.get("", response_model=APIResponse[list[SiteBuildingResponse]])
def list_site_buildings(
    ctx: Annotated[TenantContext, Depends(require_site_read())],
    db: Annotated[Session, Depends(get_db)],
    company_id: UUID | None = None,
    location_id: Annotated[UUID | None, Query()] = None,
    search: str | None = None,
):
    rows = SiteLocationService(db).list_buildings(
        ctx, company_id=company_id, location_id=location_id, search=search
    )
    return APIResponse(message="OK", data=[SiteBuildingResponse(**r) for r in rows])


@site_buildings_router.post(
    "",
    response_model=APIResponse[SiteBuildingResponse],
    status_code=201,
)
def create_site_building(
    body: SiteBuildingCreate,
    ctx: Annotated[TenantContext, Depends(require_site_admin("asset.site:create"))],
    db: Annotated[Session, Depends(get_db)],
):
    row = SiteLocationService(db).create_building(ctx, **body.model_dump())
    db.commit()
    return APIResponse(message="Created", data=SiteBuildingResponse(**row))


@site_buildings_router.patch(
    "/{row_id}",
    response_model=APIResponse[SiteBuildingResponse],
)
def update_site_building(
    row_id: UUID,
    body: SiteBuildingUpdate,
    ctx: Annotated[TenantContext, Depends(require_site_admin("asset.site:update"))],
    db: Annotated[Session, Depends(get_db)],
):
    row = SiteLocationService(db).update_building(
        ctx, row_id, **body.model_dump(exclude_unset=True)
    )
    db.commit()
    return APIResponse(message="Updated", data=SiteBuildingResponse(**row))


@site_buildings_router.post("/{row_id}/deactivate", response_model=APIResponse[None])
def deactivate_site_building(
    row_id: UUID,
    ctx: Annotated[TenantContext, Depends(require_site_admin("asset.site:update"))],
    db: Annotated[Session, Depends(get_db)],
):
    SiteLocationService(db).deactivate_building(ctx, row_id)
    db.commit()
    return APIResponse(message="Removed", data=None)
