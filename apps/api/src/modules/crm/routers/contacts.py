"""CRM Contact REST endpoints."""

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
from modules.crm.schemas import ContactCreate, ContactResponse, ContactUpdate
from modules.crm.service import ContactService
from modules.foundation.dependencies import require_permission
from modules.foundation.domain.value_objects import TenantContext
from shared.schemas import APIResponse

contacts_router = APIRouter(prefix="/contacts", tags=["CRM - Contacts"])


@contacts_router.get("", response_model=APIResponse[list[ContactResponse]])
def list_contacts(
    ctx: Annotated[TenantContext, Depends(require_permission("crm.contact:read"))],
    db: Annotated[Session, Depends(get_db)],
    pagination: Annotated[PaginationParams, Depends(get_pagination)],
    company_id: UUID | None = None,
    company_account_id: UUID | None = None,
):
    rows = ContactService(db).list(ctx, company_id, company_account_id)
    return APIResponse(message="OK", data=paginate(rows, pagination))


@contacts_router.post("", response_model=APIResponse[ContactResponse])
def create_contact(
    body: ContactCreate,
    ctx: Annotated[TenantContext, Depends(require_permission("crm.contact:create"))],
    db: Annotated[Session, Depends(get_db)],
):
    return APIResponse(message="OK", data=ContactService(db).create(ctx, **body.model_dump()))


@contacts_router.get("/{contact_id}", response_model=APIResponse[ContactResponse])
def get_contact(
    contact_id: UUID,
    ctx: Annotated[TenantContext, Depends(require_permission("crm.contact:read"))],
    db: Annotated[Session, Depends(get_db)],
):
    return APIResponse(message="OK", data=ContactService(db).get(ctx, contact_id))


@contacts_router.patch("/{contact_id}", response_model=APIResponse[ContactResponse])
def update_contact(
    contact_id: UUID,
    body: ContactUpdate,
    ctx: Annotated[TenantContext, Depends(require_permission("crm.contact:update"))],
    db: Annotated[Session, Depends(get_db)],
):
    return APIResponse(message="OK", data=ContactService(db).update(ctx, contact_id, **extract_update_fields(body)))
