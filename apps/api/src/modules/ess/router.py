"""ESS REST routes — employee-scoped self-service (auth only, no admin RBAC)."""

from datetime import date
from typing import Annotated
from uuid import UUID

from fastapi import APIRouter, Depends, Query
from sqlalchemy.orm import Session

from modules.ess.dependencies import get_db, get_tenant_context
from modules.ess.schemas import (
    EssAttendanceResponse,
    EssLeaveBalanceResponse,
    EssLeaveRequestCreate,
    EssLeaveRequestResponse,
    EssLeaveTypeResponse,
    EssMeResponse,
    EssPayslipDetail,
    EssPayslipSummary,
    EssPunchResponse,
)
from modules.ess.service import EssService
from modules.foundation.domain.value_objects import TenantContext
from shared.schemas import APIResponse

ess_router = APIRouter(prefix="/ess", tags=["Employee Self-Service"])


@ess_router.get("/me", response_model=APIResponse[EssMeResponse])
def get_me(
    ctx: Annotated[TenantContext, Depends(get_tenant_context)],
    db: Annotated[Session, Depends(get_db)],
):
    return APIResponse(message="OK", data=EssService(db).get_me(ctx))


@ess_router.get("/leave-types", response_model=APIResponse[list[EssLeaveTypeResponse]])
def list_leave_types(
    ctx: Annotated[TenantContext, Depends(get_tenant_context)],
    db: Annotated[Session, Depends(get_db)],
):
    return APIResponse(message="OK", data=EssService(db).list_leave_types(ctx))


@ess_router.get("/leave-balances", response_model=APIResponse[list[EssLeaveBalanceResponse]])
def list_leave_balances(
    ctx: Annotated[TenantContext, Depends(get_tenant_context)],
    db: Annotated[Session, Depends(get_db)],
):
    return APIResponse(message="OK", data=EssService(db).list_leave_balances(ctx))


@ess_router.get("/leave-requests", response_model=APIResponse[list[EssLeaveRequestResponse]])
def list_leave_requests(
    ctx: Annotated[TenantContext, Depends(get_tenant_context)],
    db: Annotated[Session, Depends(get_db)],
):
    return APIResponse(message="OK", data=EssService(db).list_leave_requests(ctx))


@ess_router.post("/leave-requests", response_model=APIResponse[EssLeaveRequestResponse])
def create_leave_request(
    body: EssLeaveRequestCreate,
    ctx: Annotated[TenantContext, Depends(get_tenant_context)],
    db: Annotated[Session, Depends(get_db)],
):
    return APIResponse(
        message="Leave request submitted",
        data=EssService(db).create_leave_request(ctx, body),
    )


@ess_router.get("/attendance", response_model=APIResponse[list[EssAttendanceResponse]])
def list_attendance(
    ctx: Annotated[TenantContext, Depends(get_tenant_context)],
    db: Annotated[Session, Depends(get_db)],
    from_date: Annotated[date | None, Query()] = None,
    to_date: Annotated[date | None, Query()] = None,
):
    return APIResponse(
        message="OK",
        data=EssService(db).list_attendance(ctx, from_date=from_date, to_date=to_date),
    )


@ess_router.post("/attendance/punch", response_model=APIResponse[EssPunchResponse])
def punch_attendance(
    ctx: Annotated[TenantContext, Depends(get_tenant_context)],
    db: Annotated[Session, Depends(get_db)],
):
    return APIResponse(message="OK", data=EssService(db).punch(ctx))


@ess_router.get("/payslips", response_model=APIResponse[list[EssPayslipSummary]])
def list_payslips(
    ctx: Annotated[TenantContext, Depends(get_tenant_context)],
    db: Annotated[Session, Depends(get_db)],
):
    return APIResponse(message="OK", data=EssService(db).list_payslips(ctx))


@ess_router.get("/payslips/{payslip_id}", response_model=APIResponse[EssPayslipDetail])
def get_payslip(
    payslip_id: UUID,
    ctx: Annotated[TenantContext, Depends(get_tenant_context)],
    db: Annotated[Session, Depends(get_db)],
):
    return APIResponse(message="OK", data=EssService(db).get_payslip(ctx, payslip_id))
