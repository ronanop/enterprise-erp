"""HR leave-adjust REST routes."""

from datetime import date
from typing import Annotated
from uuid import UUID

from fastapi import APIRouter, Depends, Query
from sqlalchemy.orm import Session

from modules.foundation.dependencies import require_any_permission, require_permission
from modules.foundation.domain.value_objects import TenantContext
from modules.hr.dependencies import get_db
from modules.hr.schemas import (
    LeaveAdjustApplyDayRequest,
    LeaveAdjustConfirmRequest,
    LeaveAdjustRevertRequest,
)
from modules.hr.service.leave_adjust_service import LeaveAdjustService
from shared.schemas import APIResponse

leave_adjust_router = APIRouter(prefix="/leave-adjust", tags=["HR - Leave Adjust"])


@leave_adjust_router.get("/preview", response_model=APIResponse[dict])
def preview_leave_adjust(
    ctx: Annotated[TenantContext, Depends(require_permission("hr.leave:read"))],
    db: Annotated[Session, Depends(get_db)],
    employee_id: UUID,
    period_start: date,
    period_end: date,
    company_id: UUID | None = None,
):
    data = LeaveAdjustService(db).preview(
        ctx,
        employee_id=employee_id,
        period_start=period_start,
        period_end=period_end,
        company_id=company_id,
    )
    return APIResponse(message="OK", data=data)


@leave_adjust_router.post("/confirm", response_model=APIResponse[dict])
def confirm_leave_adjust(
    body: LeaveAdjustConfirmRequest,
    ctx: Annotated[
        TenantContext,
        Depends(require_any_permission("hr.leave:approve", "hr.leave:update")),
    ],
    db: Annotated[Session, Depends(get_db)],
):
    data = LeaveAdjustService(db).confirm(
        ctx,
        employee_id=body.employee_id,
        period_start=body.period_start,
        period_end=body.period_end,
        company_id=body.company_id,
        source=body.source,
        payroll_run_id=body.payroll_run_id,
        reason=body.reason,
    )
    return APIResponse(message="Leave adjust confirmed", data=data)


@leave_adjust_router.post("/apply-day", response_model=APIResponse[dict])
def apply_leave_adjust_day(
    body: LeaveAdjustApplyDayRequest,
    ctx: Annotated[
        TenantContext,
        Depends(require_any_permission("hr.leave:approve", "hr.leave:update")),
    ],
    db: Annotated[Session, Depends(get_db)],
):
    data = LeaveAdjustService(db).apply_day(
        ctx,
        employee_id=body.employee_id,
        period_start=body.period_start,
        period_end=body.period_end,
        attendance_date=body.attendance_date,
        leave_type_code=body.leave_type_code,
        company_id=body.company_id,
        source=body.source,
        payroll_run_id=body.payroll_run_id,
        reason=body.reason,
    )
    return APIResponse(message="Leave marked", data=data)


@leave_adjust_router.get("/history", response_model=APIResponse[list])
def leave_adjust_history(
    ctx: Annotated[TenantContext, Depends(require_permission("hr.leave:read"))],
    db: Annotated[Session, Depends(get_db)],
    employee_id: UUID | None = None,
    period_start: date | None = None,
    period_end: date | None = None,
    company_id: UUID | None = None,
    payroll_run_id: UUID | None = None,
    limit: Annotated[int, Query(ge=1, le=500)] = 200,
):
    rows = LeaveAdjustService(db).history(
        ctx,
        employee_id=employee_id,
        period_start=period_start,
        period_end=period_end,
        company_id=company_id,
        payroll_run_id=payroll_run_id,
    )
    return APIResponse(message="OK", data=rows[:limit])


@leave_adjust_router.post("/revert", response_model=APIResponse[dict])
def revert_leave_adjust(
    body: LeaveAdjustRevertRequest,
    ctx: Annotated[
        TenantContext,
        Depends(require_any_permission("hr.leave:approve", "hr.leave:update")),
    ],
    db: Annotated[Session, Depends(get_db)],
):
    data = LeaveAdjustService(db).revert(
        ctx,
        employee_id=body.employee_id,
        period_start=body.period_start,
        period_end=body.period_end,
        company_id=body.company_id,
        payroll_run_id=body.payroll_run_id,
    )
    return APIResponse(message="Leave adjust reverted", data=data)
