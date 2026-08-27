"""HRMS Superadmin Panel API — assign employees as HR Admins."""

from typing import Annotated
from uuid import UUID

from fastapi import APIRouter, Depends, Query
from sqlalchemy.orm import Session

from modules.foundation.dependencies import require_permission
from modules.foundation.domain.value_objects import TenantContext
from modules.hr.dependencies import get_db
from modules.hr.permissions import HR_SUPERADMIN_PERMISSION
from modules.hr.schemas import (
    HrActivityLogRecord,
    HrAdminAssignRequest,
    HrAdminPasswordResponse,
    HrAdminRecord,
)
from modules.hr.service.superadmin_service import HrSuperadminService
from shared.schemas import APIResponse

superadmin_router = APIRouter(prefix="/superadmin", tags=["HR - Superadmin"])


@superadmin_router.get("/admins", response_model=APIResponse[list[HrAdminRecord]])
def list_hr_admins(
    ctx: Annotated[TenantContext, Depends(require_permission(HR_SUPERADMIN_PERMISSION))],
    db: Annotated[Session, Depends(get_db)],
):
    return APIResponse(message="OK", data=HrSuperadminService(db).list_admins(ctx))


@superadmin_router.post("/admins", response_model=APIResponse[HrAdminRecord])
def assign_hr_admin(
    body: HrAdminAssignRequest,
    ctx: Annotated[TenantContext, Depends(require_permission(HR_SUPERADMIN_PERMISSION))],
    db: Annotated[Session, Depends(get_db)],
):
    data = HrSuperadminService(db).assign(ctx, body.employee_id)
    return APIResponse(message="Employee assigned as HR Admin", data=data)


@superadmin_router.post(
    "/admins/{employee_id}/reset-password",
    response_model=APIResponse[HrAdminPasswordResponse],
)
def reset_hr_admin_password(
    employee_id: UUID,
    ctx: Annotated[TenantContext, Depends(require_permission(HR_SUPERADMIN_PERMISSION))],
    db: Annotated[Session, Depends(get_db)],
):
    data = HrSuperadminService(db).reset_password(ctx, employee_id)
    return APIResponse(message="HR Admin login password generated", data=data)


@superadmin_router.delete("/admins/{employee_id}", response_model=APIResponse[None])
def revoke_hr_admin(
    employee_id: UUID,
    ctx: Annotated[TenantContext, Depends(require_permission(HR_SUPERADMIN_PERMISSION))],
    db: Annotated[Session, Depends(get_db)],
):
    HrSuperadminService(db).revoke(ctx, employee_id)
    return APIResponse(message="HR Admin access revoked", data=None)


@superadmin_router.get("/activity-logs", response_model=APIResponse[list[HrActivityLogRecord]])
def list_activity_logs(
    ctx: Annotated[TenantContext, Depends(require_permission(HR_SUPERADMIN_PERMISSION))],
    db: Annotated[Session, Depends(get_db)],
    limit: Annotated[int, Query(ge=1, le=500)] = 200,
):
    return APIResponse(message="OK", data=HrSuperadminService(db).list_activity(ctx, limit=limit))
