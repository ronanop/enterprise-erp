"""CRM Product catalog REST endpoints (used for quote / OVF line lookups)."""

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
from modules.crm.schemas import ProductCreate, ProductResponse, ProductUpdate
from modules.crm.service import ProductService
from modules.foundation.dependencies import require_permission
from modules.foundation.domain.value_objects import TenantContext
from shared.schemas import APIResponse

products_router = APIRouter(prefix="/products", tags=["CRM - Products"])


@products_router.get("", response_model=APIResponse[list[ProductResponse]])
def list_products(
    ctx: Annotated[TenantContext, Depends(require_permission("crm.product:read"))],
    db: Annotated[Session, Depends(get_db)],
    pagination: Annotated[PaginationParams, Depends(get_pagination)],
    company_id: UUID | None = None,
):
    rows = ProductService(db).list(ctx, company_id)
    return APIResponse(message="OK", data=paginate(rows, pagination))


@products_router.post("", response_model=APIResponse[ProductResponse])
def create_product(
    body: ProductCreate,
    ctx: Annotated[TenantContext, Depends(require_permission("crm.product:create"))],
    db: Annotated[Session, Depends(get_db)],
):
    return APIResponse(message="OK", data=ProductService(db).create(ctx, **body.model_dump()))


@products_router.get("/{product_id}", response_model=APIResponse[ProductResponse])
def get_product(
    product_id: UUID,
    ctx: Annotated[TenantContext, Depends(require_permission("crm.product:read"))],
    db: Annotated[Session, Depends(get_db)],
):
    return APIResponse(message="OK", data=ProductService(db).get(ctx, product_id))


@products_router.patch("/{product_id}", response_model=APIResponse[ProductResponse])
def update_product(
    product_id: UUID,
    body: ProductUpdate,
    ctx: Annotated[TenantContext, Depends(require_permission("crm.product:update"))],
    db: Annotated[Session, Depends(get_db)],
):
    return APIResponse(message="OK", data=ProductService(db).update(ctx, product_id, **extract_update_fields(body)))
