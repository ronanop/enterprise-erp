"""Asset domain membership API — module admin or domain admin gated in service."""

from typing import Annotated
from uuid import UUID

from fastapi import APIRouter, Depends, Query
from sqlalchemy.orm import Session

from database.session import get_db
from modules.asset.schemas import (
    DomainMembershipCreate,
    DomainMembershipListResult,
    DomainMembershipMeResponse,
    DomainMembershipResponse,
    DomainMembershipUpdate,
    DomainMembershipUserOption,
)
from modules.asset.service.domain_membership_service import DomainMembershipService
from modules.foundation.dependencies import require_permission
from modules.foundation.domain.value_objects import TenantContext
from shared.schemas import APIResponse

domain_membership_router = APIRouter(
    prefix="/asset-domain-memberships",
    tags=["Asset — Domain Membership"],
)


@domain_membership_router.get(
    "/me",
    response_model=APIResponse[DomainMembershipMeResponse],
)
def my_domain_access(
    ctx: Annotated[TenantContext, Depends(require_permission("asset.asset:read"))],
    db: Annotated[Session, Depends(get_db)],
):
    """Current user's domain memberships + admin flags (for sidebar gating)."""
    data = DomainMembershipService(db).my_access(ctx)
    return APIResponse(message="OK", data=DomainMembershipMeResponse(**data))


@domain_membership_router.get(
    "",
    response_model=APIResponse[DomainMembershipListResult],
)
def list_domain_memberships(
    ctx: Annotated[TenantContext, Depends(require_permission("asset.asset:read"))],
    db: Annotated[Session, Depends(get_db)],
    company_id: UUID | None = None,
    domain: Annotated[str | None, Query(description="IT | NON_IT")] = None,
):
    items = DomainMembershipService(db).list(ctx, company_id=company_id, domain=domain)
    payload = DomainMembershipListResult(
        items=[DomainMembershipResponse(**row) for row in items],
        total=len(items),
    )
    return APIResponse(message="OK", data=payload)


@domain_membership_router.get(
    "/assignable-users",
    response_model=APIResponse[list[DomainMembershipUserOption]],
)
def list_assignable_domain_users(
    ctx: Annotated[TenantContext, Depends(require_permission("asset.asset:read"))],
    db: Annotated[Session, Depends(get_db)],
):
    rows = DomainMembershipService(db).list_assignable_users(ctx)
    return APIResponse(
        message="OK",
        data=[DomainMembershipUserOption(**row) for row in rows],
    )


@domain_membership_router.post(
    "",
    response_model=APIResponse[DomainMembershipResponse],
    status_code=201,
)
def create_domain_membership(
    body: DomainMembershipCreate,
    ctx: Annotated[TenantContext, Depends(require_permission("asset.asset:read"))],
    db: Annotated[Session, Depends(get_db)],
):
    row = DomainMembershipService(db).create(
        ctx,
        user_id=body.user_id,
        domain=body.domain,
        role=body.role,
        company_id=body.company_id,
    )
    db.commit()
    return APIResponse(message="Assigned", data=DomainMembershipResponse(**row))


@domain_membership_router.patch(
    "/{row_id}",
    response_model=APIResponse[DomainMembershipResponse],
)
def update_domain_membership(
    row_id: UUID,
    body: DomainMembershipUpdate,
    ctx: Annotated[TenantContext, Depends(require_permission("asset.asset:read"))],
    db: Annotated[Session, Depends(get_db)],
):
    row = DomainMembershipService(db).update_role(ctx, row_id, body.role)
    db.commit()
    return APIResponse(message="Updated", data=DomainMembershipResponse(**row))


@domain_membership_router.post(
    "/{row_id}/deactivate",
    response_model=APIResponse[None],
)
def deactivate_domain_membership(
    row_id: UUID,
    ctx: Annotated[TenantContext, Depends(require_permission("asset.asset:read"))],
    db: Annotated[Session, Depends(get_db)],
):
    """Soft-delete membership (branch convention — no hard DELETE)."""
    DomainMembershipService(db).deactivate(ctx, row_id)
    db.commit()
    return APIResponse(message="Removed", data=None)
