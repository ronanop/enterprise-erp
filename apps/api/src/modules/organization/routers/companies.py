"""Company router."""

from typing import Annotated
from uuid import UUID

from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session

from database.session import get_db
from modules.foundation.dependencies import require_permission
from modules.foundation.domain.value_objects import TenantContext
from modules.organization.schemas import (
    CompanyCreateRequest,
    CompanyResponse,
    CompanyUpdateRequest,
)
from modules.organization.service.company_service import CompanyService
from shared.schemas import APIResponse

router = APIRouter(prefix="/companies", tags=["Companies"])


@router.get("", response_model=APIResponse[list[CompanyResponse]])
def list_companies(
    ctx: Annotated[TenantContext, Depends(require_permission("organization.company:read"))],
    db: Annotated[Session, Depends(get_db)],
) -> APIResponse[list[CompanyResponse]]:
    companies = CompanyService(db).list_companies(ctx)
    return APIResponse(
        message="Companies retrieved",
        data=[CompanyResponse(**c.__dict__) for c in companies],
    )


@router.post("", response_model=APIResponse[CompanyResponse])
def create_company(
    body: CompanyCreateRequest,
    ctx: Annotated[TenantContext, Depends(require_permission("organization.company:create"))],
    db: Annotated[Session, Depends(get_db)],
) -> APIResponse[CompanyResponse]:
    company = CompanyService(db).create_company(ctx, **body.model_dump())
    db.commit()
    return APIResponse(message="Company created", data=CompanyResponse(**company.__dict__))


@router.get("/{company_id}", response_model=APIResponse[CompanyResponse])
def get_company(
    company_id: UUID,
    ctx: Annotated[TenantContext, Depends(require_permission("organization.company:read"))],
    db: Annotated[Session, Depends(get_db)],
) -> APIResponse[CompanyResponse]:
    company = CompanyService(db).get_company(ctx, company_id)
    return APIResponse(message="Company retrieved", data=CompanyResponse(**company.__dict__))


@router.put("/{company_id}", response_model=APIResponse[CompanyResponse])
@router.patch("/{company_id}", response_model=APIResponse[CompanyResponse])
def update_company(
    company_id: UUID,
    body: CompanyUpdateRequest,
    ctx: Annotated[TenantContext, Depends(require_permission("organization.company:update"))],
    db: Annotated[Session, Depends(get_db)],
) -> APIResponse[CompanyResponse]:
    company = CompanyService(db).update_company(
        ctx, company_id, **body.model_dump(exclude_unset=True)
    )
    db.commit()
    return APIResponse(message="Company updated", data=CompanyResponse(**company.__dict__))


@router.delete("/{company_id}", response_model=APIResponse[None])
def delete_company(
    company_id: UUID,
    ctx: Annotated[TenantContext, Depends(require_permission("organization.company:delete"))],
    db: Annotated[Session, Depends(get_db)],
) -> APIResponse[None]:
    CompanyService(db).delete_company(ctx, company_id)
    db.commit()
    return APIResponse(message="Company deleted", data=None)


@router.post("/{company_id}/activate", response_model=APIResponse[CompanyResponse])
def activate_company(
    company_id: UUID,
    ctx: Annotated[TenantContext, Depends(require_permission("organization.company:update"))],
    db: Annotated[Session, Depends(get_db)],
) -> APIResponse[CompanyResponse]:
    company = CompanyService(db).activate(ctx, company_id)
    db.commit()
    return APIResponse(message="Company activated", data=CompanyResponse(**company.__dict__))
