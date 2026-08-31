"""Organization tree and context routers."""

from typing import Annotated
from uuid import UUID

from fastapi import APIRouter, Depends, Query
from sqlalchemy.orm import Session

from database.session import get_db
from modules.foundation.dependencies import get_tenant_context, require_permission
from modules.foundation.domain.value_objects import TenantContext
from modules.organization.schemas import BranchResponse, CompanyResponse, ContextSwitchRequest
from modules.organization.service.context_service import OrgContextService
from modules.organization.service.org_tree_service import OrgTreeService
from shared.schemas import APIResponse

tree_router = APIRouter(prefix="/organization", tags=["Organization Tree"])
context_router = APIRouter(prefix="/auth/context", tags=["Organization Context"])


@tree_router.get("/tree", response_model=APIResponse[dict])
def get_org_tree(
    ctx: Annotated[TenantContext, Depends(require_permission("organization.company:read"))],
    db: Annotated[Session, Depends(get_db)],
    company_id: UUID | None = None,
) -> APIResponse[dict]:
    tree = OrgTreeService(db).get_tree(ctx, company_id=company_id)
    return APIResponse(message="Organization tree retrieved", data=tree)


@context_router.get("", response_model=APIResponse[dict])
def get_context(
    ctx: Annotated[TenantContext, Depends(get_tenant_context)],
    db: Annotated[Session, Depends(get_db)],
) -> APIResponse[dict]:
    data = OrgContextService(db).get_context(ctx)
    return APIResponse(message="Context retrieved", data=data)


@context_router.post("/switch", response_model=APIResponse[dict])
def switch_context(
    body: ContextSwitchRequest,
    ctx: Annotated[TenantContext, Depends(get_tenant_context)],
    db: Annotated[Session, Depends(get_db)],
) -> APIResponse[dict]:
    data = OrgContextService(db).switch_context(
        ctx, company_id=body.company_id, branch_id=body.branch_id
    )
    db.commit()
    return APIResponse(message="Context switched", data=data)


@context_router.get("/companies", response_model=APIResponse[list[CompanyResponse]])
def list_context_companies(
    ctx: Annotated[TenantContext, Depends(get_tenant_context)],
    db: Annotated[Session, Depends(get_db)],
) -> APIResponse[list[CompanyResponse]]:
    companies = OrgContextService(db).list_accessible_companies(ctx)
    return APIResponse(
        message="Accessible companies",
        data=[CompanyResponse(**c.__dict__) for c in companies],
    )


@context_router.get("/branches", response_model=APIResponse[list[BranchResponse]])
def list_context_branches(
    ctx: Annotated[TenantContext, Depends(get_tenant_context)],
    db: Annotated[Session, Depends(get_db)],
    company_id: Annotated[UUID, Query()],
) -> APIResponse[list[BranchResponse]]:
    branches = OrgContextService(db).list_accessible_branches(ctx, company_id)
    return APIResponse(
        message="Accessible branches",
        data=[BranchResponse(**b.__dict__) for b in branches],
    )
