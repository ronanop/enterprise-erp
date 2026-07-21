"""Sales Account (Company) REST endpoints. Company-first: leads can only be
created from a company (POST /crm/companies/{id}/leads)."""

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
    CompanyCreate,
    CompanyResponse,
    CompanyUpdate,
    LeadCreateFromCompany,
    SalesLeadResponse,
)
from modules.crm.service import CompanyService
from modules.foundation.dependencies import require_permission
from modules.foundation.domain.value_objects import TenantContext
from shared.schemas import APIResponse

companies_router = APIRouter(prefix="/companies", tags=["CRM - Sales Companies"])


@companies_router.get("", response_model=APIResponse[list[CompanyResponse]])
def list_companies(
    ctx: Annotated[TenantContext, Depends(require_permission("crm.company:read"))],
    db: Annotated[Session, Depends(get_db)],
    pagination: Annotated[PaginationParams, Depends(get_pagination)],
    company_id: UUID | None = None,
):
    rows = CompanyService(db).list(ctx, company_id)
    return APIResponse(message="OK", data=paginate(rows, pagination))


@companies_router.post("", response_model=APIResponse[CompanyResponse])
def create_company(
    body: CompanyCreate,
    ctx: Annotated[TenantContext, Depends(require_permission("crm.company:create"))],
    db: Annotated[Session, Depends(get_db)],
):
    return APIResponse(message="OK", data=CompanyService(db).create(ctx, **body.model_dump()))


@companies_router.get("/{company_account_id}", response_model=APIResponse[CompanyResponse])
def get_company(
    company_account_id: UUID,
    ctx: Annotated[TenantContext, Depends(require_permission("crm.company:read"))],
    db: Annotated[Session, Depends(get_db)],
):
    return APIResponse(message="OK", data=CompanyService(db).get(ctx, company_account_id))


@companies_router.patch("/{company_account_id}", response_model=APIResponse[CompanyResponse])
def update_company(
    company_account_id: UUID,
    body: CompanyUpdate,
    ctx: Annotated[TenantContext, Depends(require_permission("crm.company:update"))],
    db: Annotated[Session, Depends(get_db)],
):
    return APIResponse(
        message="OK",
        data=CompanyService(db).update(ctx, company_account_id, **extract_update_fields(body)),
    )


@companies_router.post("/{company_account_id}/leads", response_model=APIResponse[SalesLeadResponse])
def create_lead_from_company(
    company_account_id: UUID,
    body: LeadCreateFromCompany,
    ctx: Annotated[TenantContext, Depends(require_permission("crm.lead:create"))],
    db: Annotated[Session, Depends(get_db)],
):
    """The ONLY supported endpoint for creating a sales-process lead (rule #1)."""
    row = CompanyService(db).create_lead(ctx, company_account_id, **body.model_dump())
    return APIResponse(message="OK", data=row)
