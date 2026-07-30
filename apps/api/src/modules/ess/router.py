"""ESS REST routes — employee-scoped self-service (auth only, no admin RBAC)."""

from datetime import date
from typing import Annotated
from uuid import UUID

from fastapi import APIRouter, Body, Depends, Query
from sqlalchemy.orm import Session

from modules.ess.dependencies import get_db, get_tenant_context
from modules.ess.schemas import (
    EssAnnouncementItem,
    EssAssetItem,
    EssAttendanceCorrectionCreate,
    EssAttendanceCorrectionResponse,
    EssAttendanceResponse,
    EssBankResponse,
    EssBankUpdate,
    EssDocumentResponse,
    EssEducationSkillsResponse,
    EssEducationSkillsUpdate,
    EssEmergencyContactResponse,
    EssEmergencyUpdate,
    EssHolidayCalendarResponse,
    EssKycResponse,
    EssLeaveBalanceResponse,
    EssLeaveRequestCreate,
    EssLeaveRequestResponse,
    EssLeaveTypeResponse,
    EssMeResponse,
    EssMeUpdate,
    EssNotificationResponse,
    EssOnDutyCreate,
    EssOnDutyResponse,
    EssCompoffCreate,
    EssCompoffResponse,
    EssDeviceTokenRegister,
    EssPayslipDetail,
    EssPayslipSummary,
    EssPerformanceItem,
    EssPunchRequest,
    EssPunchResponse,
    EssSeparationCreate,
    EssSeparationItem,
    EssTeamLeaveItem,
    EssTrainingItem,
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


@ess_router.patch("/me", response_model=APIResponse[EssMeResponse])
def patch_me(
    body: EssMeUpdate,
    ctx: Annotated[TenantContext, Depends(get_tenant_context)],
    db: Annotated[Session, Depends(get_db)],
):
    return APIResponse(
        message="Profile updated",
        data=EssService(db).update_me(ctx, **body.model_dump(exclude_unset=True)),
    )


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
    body: Annotated[EssPunchRequest | None, Body()] = None,
):
    return APIResponse(message="OK", data=EssService(db).punch(ctx, body))


@ess_router.get(
    "/attendance-corrections",
    response_model=APIResponse[list[EssAttendanceCorrectionResponse]],
)
def list_ess_corrections(
    ctx: Annotated[TenantContext, Depends(get_tenant_context)],
    db: Annotated[Session, Depends(get_db)],
):
    rows = EssService(db).list_corrections(ctx)
    return APIResponse(
        message="OK",
        data=[
            EssAttendanceCorrectionResponse(
                id=r.id,
                attendance_date=r.attendance_date,
                field_name=r.field_name,
                old_value=r.old_value,
                new_value=r.new_value,
                reason=r.reason,
                status=r.status,
                attendance_id=r.attendance_id,
            )
            for r in rows
        ],
    )


@ess_router.post(
    "/attendance-corrections",
    response_model=APIResponse[EssAttendanceCorrectionResponse],
)
def create_ess_correction(
    body: EssAttendanceCorrectionCreate,
    ctx: Annotated[TenantContext, Depends(get_tenant_context)],
    db: Annotated[Session, Depends(get_db)],
):
    row = EssService(db).create_correction(
        ctx,
        attendance_date=body.attendance_date,
        field_name=body.field_name,
        new_value=body.new_value,
        reason=body.reason,
        attendance_id=body.attendance_id,
        old_value=body.old_value,
        submit=body.submit,
    )
    return APIResponse(
        message="Correction submitted",
        data=EssAttendanceCorrectionResponse(
            id=row.id,
            attendance_date=row.attendance_date,
            field_name=row.field_name,
            old_value=row.old_value,
            new_value=row.new_value,
            reason=row.reason,
            status=row.status,
            attendance_id=row.attendance_id,
        ),
    )


@ess_router.get("/on-duty-requests", response_model=APIResponse[list[EssOnDutyResponse]])
def list_ess_on_duty(
    ctx: Annotated[TenantContext, Depends(get_tenant_context)],
    db: Annotated[Session, Depends(get_db)],
):
    rows = EssService(db).list_on_duty(ctx)
    return APIResponse(
        message="OK",
        data=[
            EssOnDutyResponse(
                id=r.id,
                duty_date=r.duty_date,
                end_date=r.end_date,
                portion=r.portion,
                duty_location=r.duty_location,
                purpose=r.purpose,
                reason=r.reason,
                status=r.status,
            )
            for r in rows
        ],
    )


@ess_router.post("/on-duty-requests", response_model=APIResponse[EssOnDutyResponse])
def create_ess_on_duty(
    body: EssOnDutyCreate,
    ctx: Annotated[TenantContext, Depends(get_tenant_context)],
    db: Annotated[Session, Depends(get_db)],
):
    row = EssService(db).create_on_duty(ctx, **body.model_dump())
    return APIResponse(
        message="On Duty submitted",
        data=EssOnDutyResponse(
            id=row.id,
            duty_date=row.duty_date,
            end_date=row.end_date,
            portion=row.portion,
            duty_location=row.duty_location,
            purpose=row.purpose,
            reason=row.reason,
            status=row.status,
        ),
    )


@ess_router.get("/compoff-requests", response_model=APIResponse[list[EssCompoffResponse]])
def list_ess_compoff(
    ctx: Annotated[TenantContext, Depends(get_tenant_context)],
    db: Annotated[Session, Depends(get_db)],
):
    rows = EssService(db).list_compoff(ctx)
    return APIResponse(
        message="OK",
        data=[
            EssCompoffResponse(
                id=r.id,
                earned_date=r.earned_date,
                extra_hours=float(r.extra_hours),
                requested_days=float(r.requested_days),
                reason=r.reason,
                status=r.status,
            )
            for r in rows
        ],
    )


@ess_router.post("/compoff-requests", response_model=APIResponse[EssCompoffResponse])
def create_ess_compoff(
    body: EssCompoffCreate,
    ctx: Annotated[TenantContext, Depends(get_tenant_context)],
    db: Annotated[Session, Depends(get_db)],
):
    row = EssService(db).create_compoff(ctx, **body.model_dump())
    return APIResponse(
        message="Comp Off submitted",
        data=EssCompoffResponse(
            id=row.id,
            earned_date=row.earned_date,
            extra_hours=float(row.extra_hours),
            requested_days=float(row.requested_days),
            reason=row.reason,
            status=row.status,
        ),
    )


@ess_router.post("/device-tokens", response_model=APIResponse[dict])
def register_ess_device_token(
    body: EssDeviceTokenRegister,
    ctx: Annotated[TenantContext, Depends(get_tenant_context)],
    db: Annotated[Session, Depends(get_db)],
):
    row = EssService(db).register_device_token(ctx, token=body.token, platform=body.platform)
    return APIResponse(
        message="Device token registered",
        data={"id": str(row.id), "platform": row.platform, "is_active": row.is_active},
    )


@ess_router.get("/profile/bank", response_model=APIResponse[EssBankResponse])
def get_bank(
    ctx: Annotated[TenantContext, Depends(get_tenant_context)],
    db: Annotated[Session, Depends(get_db)],
):
    return APIResponse(message="OK", data=EssService(db).get_bank(ctx))


@ess_router.patch("/profile/bank", response_model=APIResponse[EssBankResponse])
def update_bank(
    body: EssBankUpdate,
    ctx: Annotated[TenantContext, Depends(get_tenant_context)],
    db: Annotated[Session, Depends(get_db)],
):
    return APIResponse(message="OK", data=EssService(db).update_bank(ctx, body))


@ess_router.get("/profile/kyc", response_model=APIResponse[EssKycResponse])
def get_kyc(
    ctx: Annotated[TenantContext, Depends(get_tenant_context)],
    db: Annotated[Session, Depends(get_db)],
):
    return APIResponse(message="OK", data=EssService(db).get_kyc(ctx))


@ess_router.get("/documents", response_model=APIResponse[list[EssDocumentResponse]])
def list_documents(
    ctx: Annotated[TenantContext, Depends(get_tenant_context)],
    db: Annotated[Session, Depends(get_db)],
):
    return APIResponse(message="OK", data=EssService(db).list_documents(ctx))


@ess_router.get("/holidays", response_model=APIResponse[list[EssHolidayCalendarResponse]])
def list_holidays(
    ctx: Annotated[TenantContext, Depends(get_tenant_context)],
    db: Annotated[Session, Depends(get_db)],
):
    return APIResponse(message="OK", data=EssService(db).list_holidays(ctx))


@ess_router.get("/notifications", response_model=APIResponse[list[EssNotificationResponse]])
def list_notifications(
    ctx: Annotated[TenantContext, Depends(get_tenant_context)],
    db: Annotated[Session, Depends(get_db)],
):
    return APIResponse(message="OK", data=EssService(db).list_notifications(ctx))


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


@ess_router.get("/profile/emergency", response_model=APIResponse[EssEmergencyContactResponse])
def get_emergency(
    ctx: Annotated[TenantContext, Depends(get_tenant_context)],
    db: Annotated[Session, Depends(get_db)],
):
    return APIResponse(message="OK", data=EssService(db).get_emergency(ctx))


@ess_router.patch("/profile/emergency", response_model=APIResponse[EssEmergencyContactResponse])
def update_emergency(
    body: EssEmergencyUpdate,
    ctx: Annotated[TenantContext, Depends(get_tenant_context)],
    db: Annotated[Session, Depends(get_db)],
):
    return APIResponse(message="OK", data=EssService(db).update_emergency(ctx, body))


@ess_router.get("/profile/education", response_model=APIResponse[EssEducationSkillsResponse])
def get_education(
    ctx: Annotated[TenantContext, Depends(get_tenant_context)],
    db: Annotated[Session, Depends(get_db)],
):
    return APIResponse(message="OK", data=EssService(db).get_education_skills(ctx))


@ess_router.patch("/profile/education", response_model=APIResponse[EssEducationSkillsResponse])
def update_education(
    body: EssEducationSkillsUpdate,
    ctx: Annotated[TenantContext, Depends(get_tenant_context)],
    db: Annotated[Session, Depends(get_db)],
):
    return APIResponse(message="OK", data=EssService(db).update_education_skills(ctx, body))


@ess_router.get("/team-leave", response_model=APIResponse[list[EssTeamLeaveItem]])
def list_team_leave(
    ctx: Annotated[TenantContext, Depends(get_tenant_context)],
    db: Annotated[Session, Depends(get_db)],
):
    return APIResponse(message="OK", data=EssService(db).list_team_leave(ctx))


@ess_router.post("/team-leave/{row_id}/manager-approve", response_model=APIResponse[EssLeaveRequestResponse])
def manager_approve_team_leave(
    row_id: UUID,
    ctx: Annotated[TenantContext, Depends(get_tenant_context)],
    db: Annotated[Session, Depends(get_db)],
):
    from modules.ess.service import _leave_request_response

    row = EssService(db).manager_approve_team_leave(ctx, row_id)
    return APIResponse(message="Manager approved", data=_leave_request_response(row))


@ess_router.post("/team-leave/{row_id}/reject", response_model=APIResponse[EssLeaveRequestResponse])
def reject_team_leave(
    row_id: UUID,
    ctx: Annotated[TenantContext, Depends(get_tenant_context)],
    db: Annotated[Session, Depends(get_db)],
):
    from modules.ess.service import _leave_request_response

    row = EssService(db).reject_team_leave(ctx, row_id)
    return APIResponse(message="Leave rejected", data=_leave_request_response(row))


@ess_router.get("/announcements", response_model=APIResponse[list[EssAnnouncementItem]])
def list_announcements(
    ctx: Annotated[TenantContext, Depends(get_tenant_context)],
    db: Annotated[Session, Depends(get_db)],
):
    return APIResponse(message="OK", data=EssService(db).list_announcements(ctx))


@ess_router.get("/assets", response_model=APIResponse[list[EssAssetItem]])
def list_assets(
    ctx: Annotated[TenantContext, Depends(get_tenant_context)],
    db: Annotated[Session, Depends(get_db)],
):
    return APIResponse(message="OK", data=EssService(db).list_assets(ctx))


@ess_router.get("/training", response_model=APIResponse[list[EssTrainingItem]])
def list_training(
    ctx: Annotated[TenantContext, Depends(get_tenant_context)],
    db: Annotated[Session, Depends(get_db)],
):
    return APIResponse(message="OK", data=EssService(db).list_training(ctx))


@ess_router.get("/performance", response_model=APIResponse[list[EssPerformanceItem]])
def list_performance(
    ctx: Annotated[TenantContext, Depends(get_tenant_context)],
    db: Annotated[Session, Depends(get_db)],
):
    return APIResponse(message="OK", data=EssService(db).list_performance(ctx))


@ess_router.get("/separation", response_model=APIResponse[list[EssSeparationItem]])
def list_separation(
    ctx: Annotated[TenantContext, Depends(get_tenant_context)],
    db: Annotated[Session, Depends(get_db)],
):
    return APIResponse(message="OK", data=EssService(db).list_separation(ctx))


@ess_router.post("/separation", response_model=APIResponse[EssSeparationItem])
def create_separation(
    body: EssSeparationCreate,
    ctx: Annotated[TenantContext, Depends(get_tenant_context)],
    db: Annotated[Session, Depends(get_db)],
):
    return APIResponse(
        message="Separation request created",
        data=EssService(db).create_separation(ctx, body),
    )
