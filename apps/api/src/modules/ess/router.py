"""ESS REST routes — employee-scoped self-service (auth only, no admin RBAC)."""

from datetime import date
from io import BytesIO
from typing import Annotated
from urllib.parse import quote
from uuid import UUID

from fastapi import APIRouter, Body, Depends, Query
from fastapi.responses import FileResponse, StreamingResponse
from sqlalchemy.orm import Session

from modules.ess.dependencies import get_db, get_tenant_context
from modules.ess.schemas import (
    EssAnnouncementItem,
    EssApprovalItem,
    EssAssetDetail,
    EssAssetItem,
    EssAssetTicketCreate,
    EssAttendanceCorrectionCreate,
    EssAttendanceCorrectionResponse,
    EssAttendanceResponse,
    EssAttendanceSummaryResponse,
    EssBankResponse,
    EssBankUpdate,
    EssDocumentResponse,
    EssDocumentUploadBody,
    EssEducationSkillsResponse,
    EssEducationSkillsUpdate,
    EssEmergencyContactResponse,
    EssEmergencyUpdate,
    EssFaceImageBody,
    EssFaceStatusResponse,
    EssFaceVerifyResponse,
    EssFaceEnabledBody,
    EssHolidayCalendarResponse,
    EssKycResponse,
    EssLeaveBalanceResponse,
    EssLeaveRequestCreate,
    EssLeaveRequestResponse,
    EssLeaveTypeResponse,
    EssMeResponse,
    EssMeUpdate,
    EssMeetingBookingCreate,
    EssMeetingBookingResponse,
    EssMeetingRoomAvailability,
    EssMeetingRoomItem,
    EssNotificationResponse,
    EssNotificationPollResponse,
    EssOnDutyCreate,
    EssOnDutyResponse,
    EssChangePasswordBody,
    EssCompoffCreate,
    EssCompoffResponse,
    EssDeviceTokenRegister,
    EssPayslipDetail,
    EssPayslipSummary,
    EssPerformanceItem,
    EssPunchRequest,
    EssPunchResponse,
    EssPunchPolicyResponse,
    EssPolicyAckResponse,
    EssPolicyItem,
    EssPolicyWalkthrough,
    EssSeparationCreate,
    EssSeparationItem,
    EssSupportTicketCommentCreate,
    EssSupportTicketCommentItem,
    EssSupportTicketCreate,
    EssSupportTicketDetail,
    EssSupportTicketItem,
    EssTeamLeaveItem,
    EssTrainingItem,
    EssUnreadCountResponse,
    EssWfhCreate,
    EssWfhResponse,
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


@ess_router.get(
    "/leave-requests/{request_id}",
    response_model=APIResponse[EssLeaveRequestResponse],
)
def get_leave_request(
    request_id: UUID,
    ctx: Annotated[TenantContext, Depends(get_tenant_context)],
    db: Annotated[Session, Depends(get_db)],
):
    return APIResponse(
        message="OK",
        data=EssService(db).get_leave_request(ctx, request_id),
    )


@ess_router.post(
    "/leave-requests/{request_id}/cancel",
    response_model=APIResponse[EssLeaveRequestResponse],
)
def cancel_leave_request(
    request_id: UUID,
    ctx: Annotated[TenantContext, Depends(get_tenant_context)],
    db: Annotated[Session, Depends(get_db)],
):
    return APIResponse(
        message="Leave request cancelled",
        data=EssService(db).cancel_leave_request(ctx, request_id),
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


@ess_router.get(
    "/attendance/summary",
    response_model=APIResponse[EssAttendanceSummaryResponse],
)
def attendance_summary(
    ctx: Annotated[TenantContext, Depends(get_tenant_context)],
    db: Annotated[Session, Depends(get_db)],
    month: Annotated[str, Query(description="YYYY-MM")],
):
    return APIResponse(message="OK", data=EssService(db).attendance_summary(ctx, month=month))


@ess_router.get("/attendance/punch-policy", response_model=APIResponse[EssPunchPolicyResponse])
def punch_policy(
    ctx: Annotated[TenantContext, Depends(get_tenant_context)],
    db: Annotated[Session, Depends(get_db)],
):
    return APIResponse(message="OK", data=EssService(db).get_punch_policy(ctx))


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


@ess_router.get("/wfh-requests", response_model=APIResponse[list[EssWfhResponse]])
def list_ess_wfh(
    ctx: Annotated[TenantContext, Depends(get_tenant_context)],
    db: Annotated[Session, Depends(get_db)],
):
    rows = EssService(db).list_wfh(ctx)
    return APIResponse(
        message="OK",
        data=[
            EssWfhResponse(
                id=r.id,
                wfh_date=r.wfh_date,
                end_date=r.end_date,
                portion=r.portion,
                reason=r.reason,
                status=r.status,
            )
            for r in rows
        ],
    )


@ess_router.post("/wfh-requests", response_model=APIResponse[EssWfhResponse])
def create_ess_wfh(
    body: EssWfhCreate,
    ctx: Annotated[TenantContext, Depends(get_tenant_context)],
    db: Annotated[Session, Depends(get_db)],
):
    row = EssService(db).create_wfh(ctx, **body.model_dump())
    return APIResponse(
        message="WFH submitted",
        data=EssWfhResponse(
            id=row.id,
            wfh_date=row.wfh_date,
            end_date=row.end_date,
            portion=row.portion,
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


@ess_router.get("/documents/{document_id}", response_model=APIResponse[EssDocumentResponse])
def get_document(
    document_id: UUID,
    ctx: Annotated[TenantContext, Depends(get_tenant_context)],
    db: Annotated[Session, Depends(get_db)],
):
    return APIResponse(message="OK", data=EssService(db).get_document(ctx, document_id))


@ess_router.post("/documents", response_model=APIResponse[EssDocumentResponse])
def upload_document(
    body: EssDocumentUploadBody,
    ctx: Annotated[TenantContext, Depends(get_tenant_context)],
    db: Annotated[Session, Depends(get_db)],
):
    return APIResponse(
        message="Document uploaded",
        data=EssService(db).upload_document(ctx, body),
    )


@ess_router.get("/documents/{document_id}/download")
def download_document(
    document_id: UUID,
    ctx: Annotated[TenantContext, Depends(get_tenant_context)],
    db: Annotated[Session, Depends(get_db)],
):
    download = EssService(db).resolve_document_download(ctx, document_id)
    headers = {
        "Content-Disposition": f'attachment; filename="{quote(download.filename)}"'
    }
    if download.path:
        return FileResponse(
            download.path,
            media_type=download.media_type,
            filename=download.filename,
        )
    return StreamingResponse(
        BytesIO(download.content or b""),
        media_type=download.media_type,
        headers=headers,
    )


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


@ess_router.get("/notifications/unread-count", response_model=APIResponse[EssUnreadCountResponse])
def notification_unread_count(
    ctx: Annotated[TenantContext, Depends(get_tenant_context)],
    db: Annotated[Session, Depends(get_db)],
):
    count = EssService(db).notification_unread_count(ctx)
    return APIResponse(message="OK", data=EssUnreadCountResponse(unread_count=count))


@ess_router.get("/notifications/poll", response_model=APIResponse[EssNotificationPollResponse])
def notification_poll(
    ctx: Annotated[TenantContext, Depends(get_tenant_context)],
    db: Annotated[Session, Depends(get_db)],
):
    return APIResponse(message="OK", data=EssService(db).notification_poll(ctx))


@ess_router.post("/notifications/read-all", response_model=APIResponse[dict])
def mark_all_notifications_read(
    ctx: Annotated[TenantContext, Depends(get_tenant_context)],
    db: Annotated[Session, Depends(get_db)],
):
    updated = EssService(db).mark_all_notifications_read(ctx)
    db.commit()
    return APIResponse(message="OK", data={"marked": updated})


@ess_router.post("/notifications/{notification_id}/read", response_model=APIResponse[dict])
def mark_notification_read(
    notification_id: UUID,
    ctx: Annotated[TenantContext, Depends(get_tenant_context)],
    db: Annotated[Session, Depends(get_db)],
):
    EssService(db).mark_notification_read(ctx, notification_id)
    db.commit()
    return APIResponse(message="OK", data={"id": str(notification_id)})


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


@ess_router.get("/payslips/{payslip_id}/export-text", response_model=APIResponse[dict])
def export_payslip_text(
    payslip_id: UUID,
    ctx: Annotated[TenantContext, Depends(get_tenant_context)],
    db: Annotated[Session, Depends(get_db)],
):
    text = EssService(db).get_payslip_export_text(ctx, payslip_id)
    return APIResponse(message="OK", data={"text": text})


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


@ess_router.get("/approvals", response_model=APIResponse[list[EssApprovalItem]])
def list_pending_approvals(
    ctx: Annotated[TenantContext, Depends(get_tenant_context)],
    db: Annotated[Session, Depends(get_db)],
):
    return APIResponse(message="OK", data=EssService(db).list_pending_approvals(ctx))


@ess_router.post("/team-compoff/{row_id}/manager-approve", response_model=APIResponse[dict])
def manager_approve_team_compoff(
    row_id: UUID,
    ctx: Annotated[TenantContext, Depends(get_tenant_context)],
    db: Annotated[Session, Depends(get_db)],
):
    row = EssService(db).manager_approve_team_compoff(ctx, row_id)
    return APIResponse(message="Manager approved", data={"id": str(row.id), "status": row.status})


@ess_router.post("/team-compoff/{row_id}/reject", response_model=APIResponse[dict])
def reject_team_compoff(
    row_id: UUID,
    ctx: Annotated[TenantContext, Depends(get_tenant_context)],
    db: Annotated[Session, Depends(get_db)],
):
    row = EssService(db).reject_team_compoff(ctx, row_id)
    return APIResponse(message="Rejected", data={"id": str(row.id), "status": row.status})


@ess_router.post("/team-on-duty/{row_id}/approve", response_model=APIResponse[dict])
def approve_team_on_duty(
    row_id: UUID,
    ctx: Annotated[TenantContext, Depends(get_tenant_context)],
    db: Annotated[Session, Depends(get_db)],
):
    row = EssService(db).approve_team_on_duty(ctx, row_id)
    return APIResponse(message="Approved", data={"id": str(row.id), "status": row.status})


@ess_router.post("/team-on-duty/{row_id}/reject", response_model=APIResponse[dict])
def reject_team_on_duty(
    row_id: UUID,
    ctx: Annotated[TenantContext, Depends(get_tenant_context)],
    db: Annotated[Session, Depends(get_db)],
):
    row = EssService(db).reject_team_on_duty(ctx, row_id)
    return APIResponse(message="Rejected", data={"id": str(row.id), "status": row.status})


@ess_router.post("/team-corrections/{row_id}/approve", response_model=APIResponse[dict])
def approve_team_correction(
    row_id: UUID,
    ctx: Annotated[TenantContext, Depends(get_tenant_context)],
    db: Annotated[Session, Depends(get_db)],
):
    row = EssService(db).approve_team_correction(ctx, row_id)
    return APIResponse(message="Approved", data={"id": str(row.id), "status": row.status})


@ess_router.post("/team-corrections/{row_id}/reject", response_model=APIResponse[dict])
def reject_team_correction(
    row_id: UUID,
    ctx: Annotated[TenantContext, Depends(get_tenant_context)],
    db: Annotated[Session, Depends(get_db)],
):
    row = EssService(db).reject_team_correction(ctx, row_id)
    return APIResponse(message="Rejected", data={"id": str(row.id), "status": row.status})


@ess_router.post("/team-wfh/{row_id}/manager-approve", response_model=APIResponse[dict])
def manager_approve_team_wfh(
    row_id: UUID,
    ctx: Annotated[TenantContext, Depends(get_tenant_context)],
    db: Annotated[Session, Depends(get_db)],
):
    row = EssService(db).manager_approve_team_wfh(ctx, row_id)
    return APIResponse(message="Approved", data={"id": str(row.id), "status": row.status})


@ess_router.post("/team-wfh/{row_id}/reject", response_model=APIResponse[dict])
def reject_team_wfh(
    row_id: UUID,
    ctx: Annotated[TenantContext, Depends(get_tenant_context)],
    db: Annotated[Session, Depends(get_db)],
):
    row = EssService(db).reject_team_wfh(ctx, row_id)
    return APIResponse(message="Rejected", data={"id": str(row.id), "status": row.status})


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


@ess_router.get("/security/face/status", response_model=APIResponse[EssFaceStatusResponse])
def face_status(
    ctx: Annotated[TenantContext, Depends(get_tenant_context)],
    db: Annotated[Session, Depends(get_db)],
):
    return APIResponse(message="OK", data=EssService(db).face_status(ctx))


@ess_router.post("/security/face/enroll", response_model=APIResponse[EssFaceStatusResponse])
def face_enroll(
    body: EssFaceImageBody,
    ctx: Annotated[TenantContext, Depends(get_tenant_context)],
    db: Annotated[Session, Depends(get_db)],
):
    return APIResponse(
        message="Face enrolled",
        data=EssService(db).face_enroll(ctx, body.image_base64),
    )


@ess_router.post("/security/face/verify", response_model=APIResponse[EssFaceVerifyResponse])
def face_verify(
    body: EssFaceImageBody,
    ctx: Annotated[TenantContext, Depends(get_tenant_context)],
    db: Annotated[Session, Depends(get_db)],
):
    return APIResponse(
        message="OK",
        data=EssService(db).face_verify(ctx, body.image_base64),
    )


@ess_router.patch("/security/face/enabled", response_model=APIResponse[EssFaceStatusResponse])
def face_set_enabled(
    body: EssFaceEnabledBody,
    ctx: Annotated[TenantContext, Depends(get_tenant_context)],
    db: Annotated[Session, Depends(get_db)],
):
    return APIResponse(
        message="OK",
        data=EssService(db).face_set_enabled(ctx, body.enabled),
    )


@ess_router.get("/meeting-rooms", response_model=APIResponse[list[EssMeetingRoomItem]])
def list_meeting_rooms(
    ctx: Annotated[TenantContext, Depends(get_tenant_context)],
    db: Annotated[Session, Depends(get_db)],
):
    return APIResponse(message="OK", data=EssService(db).list_meeting_rooms(ctx))


@ess_router.get("/meeting-rooms/availability", response_model=APIResponse[list[EssMeetingRoomAvailability]])
def meeting_room_availability(
    on_date: date,
    ctx: Annotated[TenantContext, Depends(get_tenant_context)],
    db: Annotated[Session, Depends(get_db)],
):
    return APIResponse(message="OK", data=EssService(db).meeting_room_availability(ctx, on_date=on_date))


@ess_router.get("/meeting-rooms/bookings", response_model=APIResponse[list[EssMeetingBookingResponse]])
def list_meeting_bookings(
    ctx: Annotated[TenantContext, Depends(get_tenant_context)],
    db: Annotated[Session, Depends(get_db)],
    on_date: date | None = None,
):
    return APIResponse(message="OK", data=EssService(db).list_meeting_bookings(ctx, on_date=on_date))


@ess_router.post("/meeting-rooms/bookings", response_model=APIResponse[EssMeetingBookingResponse])
def create_meeting_booking(
    body: EssMeetingBookingCreate,
    ctx: Annotated[TenantContext, Depends(get_tenant_context)],
    db: Annotated[Session, Depends(get_db)],
):
    row = EssService(db).create_meeting_booking(ctx, body)
    db.commit()
    return APIResponse(message="Booked", data=row)


@ess_router.get("/assets/lookup", response_model=APIResponse[EssAssetDetail])
def lookup_asset(
    code: str,
    ctx: Annotated[TenantContext, Depends(get_tenant_context)],
    db: Annotated[Session, Depends(get_db)],
):
    return APIResponse(message="OK", data=EssService(db).lookup_asset(ctx, code=code))


@ess_router.get("/assets/{asset_id}", response_model=APIResponse[EssAssetDetail])
def get_asset(
    asset_id: UUID,
    ctx: Annotated[TenantContext, Depends(get_tenant_context)],
    db: Annotated[Session, Depends(get_db)],
):
    return APIResponse(message="OK", data=EssService(db).get_asset(ctx, asset_id))


@ess_router.post("/assets/{asset_id}/tickets", response_model=APIResponse[EssSupportTicketDetail])
def create_asset_ticket(
    asset_id: UUID,
    body: EssAssetTicketCreate,
    ctx: Annotated[TenantContext, Depends(get_tenant_context)],
    db: Annotated[Session, Depends(get_db)],
):
    row = EssService(db).create_asset_ticket(
        ctx,
        asset_id,
        subject=body.subject or "Asset issue",
        description=body.description,
        problem_category=body.problem_category,
        urgency=body.urgency,
    )
    db.commit()
    return APIResponse(message="Ticket created", data=row)


@ess_router.get("/support-tickets", response_model=APIResponse[list[EssSupportTicketItem]])
def list_support_tickets(
    ctx: Annotated[TenantContext, Depends(get_tenant_context)],
    db: Annotated[Session, Depends(get_db)],
):
    return APIResponse(message="OK", data=EssService(db).list_support_tickets(ctx))


@ess_router.post("/support-tickets", response_model=APIResponse[EssSupportTicketDetail])
def create_support_ticket(
    body: EssSupportTicketCreate,
    ctx: Annotated[TenantContext, Depends(get_tenant_context)],
    db: Annotated[Session, Depends(get_db)],
):
    row = EssService(db).create_support_ticket(ctx, body)
    db.commit()
    return APIResponse(message="Ticket created", data=row)


@ess_router.get("/support-tickets/{ticket_id}", response_model=APIResponse[EssSupportTicketDetail])
def get_support_ticket(
    ticket_id: UUID,
    ctx: Annotated[TenantContext, Depends(get_tenant_context)],
    db: Annotated[Session, Depends(get_db)],
):
    return APIResponse(message="OK", data=EssService(db).get_support_ticket(ctx, ticket_id))


@ess_router.get(
    "/support-tickets/{ticket_id}/comments",
    response_model=APIResponse[list[EssSupportTicketCommentItem]],
)
def list_support_ticket_comments(
    ticket_id: UUID,
    ctx: Annotated[TenantContext, Depends(get_tenant_context)],
    db: Annotated[Session, Depends(get_db)],
):
    return APIResponse(message="OK", data=EssService(db).list_support_ticket_comments(ctx, ticket_id))


@ess_router.post(
    "/support-tickets/{ticket_id}/comments",
    response_model=APIResponse[EssSupportTicketCommentItem],
)
def add_support_ticket_comment(
    ticket_id: UUID,
    body: EssSupportTicketCommentCreate,
    ctx: Annotated[TenantContext, Depends(get_tenant_context)],
    db: Annotated[Session, Depends(get_db)],
):
    row = EssService(db).add_support_ticket_comment(ctx, ticket_id, body)
    db.commit()
    return APIResponse(message="Comment added", data=row)


@ess_router.get("/policies", response_model=APIResponse[list[EssPolicyItem]])
def list_ess_policies(
    ctx: Annotated[TenantContext, Depends(get_tenant_context)],
    db: Annotated[Session, Depends(get_db)],
):
    return APIResponse(message="OK", data=EssService(db).list_policies(ctx))


@ess_router.get("/policies/{policy_id}", response_model=APIResponse[EssPolicyWalkthrough])
def get_ess_policy_walkthrough(
    policy_id: UUID,
    ctx: Annotated[TenantContext, Depends(get_tenant_context)],
    db: Annotated[Session, Depends(get_db)],
):
    return APIResponse(message="OK", data=EssService(db).get_policy_walkthrough(ctx, policy_id))


@ess_router.post("/policies/{policy_id}/acknowledge", response_model=APIResponse[EssPolicyAckResponse])
def acknowledge_ess_policy(
    policy_id: UUID,
    ctx: Annotated[TenantContext, Depends(get_tenant_context)],
    db: Annotated[Session, Depends(get_db)],
):
    row = EssService(db).acknowledge_policy(ctx, policy_id)
    db.commit()
    return APIResponse(message="Acknowledged", data=row)


@ess_router.post("/security/change-password", response_model=APIResponse[dict])
def ess_change_password(
    body: EssChangePasswordBody,
    ctx: Annotated[TenantContext, Depends(get_tenant_context)],
    db: Annotated[Session, Depends(get_db)],
):
    EssService(db).change_password(ctx, body)
    db.commit()
    return APIResponse(message="Password updated", data={"ok": True})
