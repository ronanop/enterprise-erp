"""HR REST routes for ESS policy administration."""

from typing import Annotated
from uuid import UUID

from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session

from modules.foundation.dependencies import get_db, get_tenant_context, require_permission
from modules.foundation.domain.value_objects import TenantContext
from modules.hr.schemas import (
    EssPolicyAdminCreate,
    EssPolicyAdminResponse,
    EssPolicyAdminUpdate,
)
from modules.hr.service.ess_policy_admin_service import EssPolicyAdminService
from shared.schemas import APIResponse

ess_policies_router = APIRouter(prefix="/ess-policies", tags=["HR - ESS Policies"])


@ess_policies_router.get("", response_model=APIResponse[list[EssPolicyAdminResponse]])
def list_ess_policies(
    ctx: Annotated[TenantContext, Depends(require_permission("hr.employee_profile:read"))],
    db: Annotated[Session, Depends(get_db)],
    company_id: UUID | None = None,
):
    rows = EssPolicyAdminService(db).list(ctx, company_id=company_id)
    return APIResponse(message="OK", data=[EssPolicyAdminResponse.model_validate(r) for r in rows])


@ess_policies_router.post("", response_model=APIResponse[EssPolicyAdminResponse])
def create_ess_policy(
    body: EssPolicyAdminCreate,
    ctx: Annotated[TenantContext, Depends(require_permission("hr.employee_profile:create"))],
    db: Annotated[Session, Depends(get_db)],
):
    row = EssPolicyAdminService(db).create(ctx, **body.model_dump(exclude_none=True))
    db.commit()
    return APIResponse(message="Created", data=EssPolicyAdminResponse.model_validate(row))


@ess_policies_router.patch("/{row_id}", response_model=APIResponse[EssPolicyAdminResponse])
def update_ess_policy(
    row_id: UUID,
    body: EssPolicyAdminUpdate,
    ctx: Annotated[TenantContext, Depends(require_permission("hr.employee_profile:update"))],
    db: Annotated[Session, Depends(get_db)],
):
    row = EssPolicyAdminService(db).update(
        ctx, row_id, **body.model_dump(exclude_none=True)
    )
    db.commit()
    return APIResponse(message="Updated", data=EssPolicyAdminResponse.model_validate(row))


@ess_policies_router.post("/{row_id}/publish", response_model=APIResponse[EssPolicyAdminResponse])
def publish_ess_policy(
    row_id: UUID,
    ctx: Annotated[TenantContext, Depends(require_permission("hr.employee_profile:update"))],
    db: Annotated[Session, Depends(get_db)],
):
    row = EssPolicyAdminService(db).publish(ctx, row_id)
    db.commit()
    return APIResponse(message="Published", data=EssPolicyAdminResponse.model_validate(row))


@ess_policies_router.post("/{row_id}/archive", response_model=APIResponse[EssPolicyAdminResponse])
def archive_ess_policy(
    row_id: UUID,
    ctx: Annotated[TenantContext, Depends(require_permission("hr.employee_profile:update"))],
    db: Annotated[Session, Depends(get_db)],
):
    row = EssPolicyAdminService(db).archive(ctx, row_id)
    db.commit()
    return APIResponse(message="Archived", data=EssPolicyAdminResponse.model_validate(row))
