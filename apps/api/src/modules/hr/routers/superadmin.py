"""HRMS Superadmin Panel API — assign employees as HR Admins."""

from collections.abc import Callable
from typing import Annotated
from uuid import UUID

from fastapi import APIRouter, Depends, Query
from sqlalchemy.orm import Session

from core.exceptions import ForbiddenException
from modules.foundation.dependencies import get_tenant_context
from modules.foundation.domain.value_objects import TenantContext
from modules.foundation.service.rbac_service import RBACService
from modules.hr.dependencies import get_db
from modules.hr.permissions import HR_SUPERADMIN_PERMISSION
from modules.hr.schemas import (
    HrActivityLogRecord,
    HrAdminAssignRequest,
    HrAdminEntitiesRequest,
    HrAdminEntityOption,
    HrAdminNavRequest,
    HrAdminPasswordResponse,
    HrAdminRecord,
    HrNavAccessRecord,
)
from modules.hr.service.hr_module_admin import HrModuleAdminService
from modules.hr.service.superadmin_service import HrSuperadminService
from shared.schemas import APIResponse

superadmin_router = APIRouter(prefix="/superadmin", tags=["HR - Superadmin"])
hr_nav_access_router = APIRouter(tags=["HR - Nav"])


def require_hr_superadmin_access() -> Callable:
    """Allow HR module admins or users with hr.superadmin:manage."""

    def _checker(
        ctx: Annotated[TenantContext, Depends(get_tenant_context)],
        db: Annotated[Session, Depends(get_db)],
    ) -> TenantContext:
        if HrModuleAdminService(db).is_admin(ctx):
            return ctx
        rbac = RBACService(db)
        if ctx.user_type in {"super_admin", "tenant_admin"}:
            return ctx
        if ctx.user_id is not None and rbac.has_permission(
            ctx.user_id, ctx.tenant_id, HR_SUPERADMIN_PERMISSION
        ):
            return ctx
        raise ForbiddenException("HR superadmin or HR module admin access required")

    return _checker


@hr_nav_access_router.get("/nav-access", response_model=APIResponse[HrNavAccessRecord])
def get_my_hr_nav_access(
    ctx: Annotated[TenantContext, Depends(get_tenant_context)],
    db: Annotated[Session, Depends(get_db)],
):
    return APIResponse(message="OK", data=HrSuperadminService(db).my_nav_access(ctx))


@superadmin_router.get("/admins", response_model=APIResponse[list[HrAdminRecord]])
def list_hr_admins(
    ctx: Annotated[TenantContext, Depends(require_hr_superadmin_access())],
    db: Annotated[Session, Depends(get_db)],
):
    return APIResponse(message="OK", data=HrSuperadminService(db).list_admins(ctx))


@superadmin_router.get("/entities", response_model=APIResponse[list[HrAdminEntityOption]])
def list_hr_entities(
    ctx: Annotated[TenantContext, Depends(require_hr_superadmin_access())],
    db: Annotated[Session, Depends(get_db)],
):
    return APIResponse(message="OK", data=HrSuperadminService(db).list_entities(ctx))


@superadmin_router.post("/admins", response_model=APIResponse[HrAdminRecord])
def assign_hr_admin(
    body: HrAdminAssignRequest,
    ctx: Annotated[TenantContext, Depends(require_hr_superadmin_access())],
    db: Annotated[Session, Depends(get_db)],
):
    data = HrSuperadminService(db).assign(ctx, body.employee_id, body.company_ids)
    return APIResponse(message="Employee assigned as HR Admin", data=data)


@superadmin_router.patch("/admins/{employee_id}/entities", response_model=APIResponse[HrAdminRecord])
def set_hr_admin_entities(
    employee_id: UUID,
    body: HrAdminEntitiesRequest,
    ctx: Annotated[TenantContext, Depends(require_hr_superadmin_access())],
    db: Annotated[Session, Depends(get_db)],
):
    data = HrSuperadminService(db).set_entities(ctx, employee_id, body.company_ids)
    return APIResponse(message="HR Admin entities updated", data=data)


@superadmin_router.patch("/admins/{employee_id}/nav", response_model=APIResponse[HrAdminRecord])
def set_hr_admin_nav(
    employee_id: UUID,
    body: HrAdminNavRequest,
    ctx: Annotated[TenantContext, Depends(require_hr_superadmin_access())],
    db: Annotated[Session, Depends(get_db)],
):
    data = HrSuperadminService(db).set_nav_keys(ctx, employee_id, body.nav_keys)
    return APIResponse(message="HR Admin sidebar menus updated", data=data)


@superadmin_router.post(
    "/admins/{employee_id}/reset-password",
    response_model=APIResponse[HrAdminPasswordResponse],
)
def reset_hr_admin_password(
    employee_id: UUID,
    ctx: Annotated[TenantContext, Depends(require_hr_superadmin_access())],
    db: Annotated[Session, Depends(get_db)],
):
    data = HrSuperadminService(db).reset_password(ctx, employee_id)
    return APIResponse(message="HR Admin login password generated", data=data)


@superadmin_router.delete("/admins/{employee_id}", response_model=APIResponse[None])
def revoke_hr_admin(
    employee_id: UUID,
    ctx: Annotated[TenantContext, Depends(require_hr_superadmin_access())],
    db: Annotated[Session, Depends(get_db)],
):
    HrSuperadminService(db).revoke(ctx, employee_id)
    return APIResponse(message="HR Admin access revoked", data=None)


@superadmin_router.get("/activity-logs", response_model=APIResponse[list[HrActivityLogRecord]])
def list_activity_logs(
    ctx: Annotated[TenantContext, Depends(require_hr_superadmin_access())],
    db: Annotated[Session, Depends(get_db)],
    limit: Annotated[int, Query(ge=1, le=500)] = 200,
):
    return APIResponse(message="OK", data=HrSuperadminService(db).list_activity(ctx, limit=limit))
