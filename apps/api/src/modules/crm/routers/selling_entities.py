"""CRM selling / billing entity master REST endpoints."""

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
    SellingEntityCreate,
    SellingEntityResponse,
    SellingEntityUpdate,
)
from modules.crm.service.selling_entity_service import SellingEntityService
from modules.foundation.dependencies import require_permission
from modules.foundation.domain.value_objects import TenantContext
from shared.schemas import APIResponse

selling_entities_router = APIRouter(prefix="/selling-entities", tags=["CRM - Selling Entities"])


@selling_entities_router.get("", response_model=APIResponse[list[SellingEntityResponse]])
def list_selling_entities(
    ctx: Annotated[TenantContext, Depends(require_permission("crm.lead:read"))],
    db: Annotated[Session, Depends(get_db)],
    pagination: Annotated[PaginationParams, Depends(get_pagination)],
    company_id: UUID | None = None,
):
    rows = SellingEntityService(db).list(ctx, company_id)
    return APIResponse(message="OK", data=paginate(rows, pagination))


@selling_entities_router.get("/{entity_id}", response_model=APIResponse[SellingEntityResponse])
def get_selling_entity(
    entity_id: UUID,
    ctx: Annotated[TenantContext, Depends(require_permission("crm.lead:read"))],
    db: Annotated[Session, Depends(get_db)],
):
    return APIResponse(message="OK", data=SellingEntityService(db).get(ctx, entity_id))


@selling_entities_router.post("", response_model=APIResponse[SellingEntityResponse])
def create_selling_entity(
    body: SellingEntityCreate,
    ctx: Annotated[TenantContext, Depends(require_permission("crm.lead:create"))],
    db: Annotated[Session, Depends(get_db)],
):
    return APIResponse(
        message="OK",
        data=SellingEntityService(db).create(ctx, **body.model_dump()),
    )


@selling_entities_router.patch("/{entity_id}", response_model=APIResponse[SellingEntityResponse])
def update_selling_entity(
    entity_id: UUID,
    body: SellingEntityUpdate,
    ctx: Annotated[TenantContext, Depends(require_permission("crm.lead:update"))],
    db: Annotated[Session, Depends(get_db)],
):
    return APIResponse(
        message="OK",
        data=SellingEntityService(db).update(ctx, entity_id, **extract_update_fields(body)),
    )
