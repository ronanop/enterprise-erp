"""HR REST routers."""

from typing import Annotated
from uuid import UUID

from fastapi import APIRouter, Depends, Header
from sqlalchemy.orm import Session

from modules.foundation.dependencies import require_any_permission, require_permission
from modules.foundation.domain.value_objects import TenantContext
from modules.hr.dependencies import (
    PaginationParams,
    extract_update_fields,
    get_db,
    get_pagination,
    paginate,
)
from modules.hr.schemas import (
    AppraisalCreate,
    AppraisalResponse,
    AttendanceCorrectionCreate,
    AttendanceCorrectionResponse,
    AttendanceCreate,
    AttendanceResponse,
    AttendanceRuleCreate,
    AttendanceRuleResponse,
    AttendanceRuleUpdate,
    AttendanceUpdate,
    DepartmentAssignmentCreate,
    DepartmentAssignmentResponse,
    DesignationAssignmentCreate,
    DesignationAssignmentResponse,
    DesignationCreate,
    DesignationResponse,
    DesignationUpdate,
    EmployeeDocumentCreate,
    EmployeeDocumentResponse,
    EmployeeProfileCreate,
    EmployeeProfileResponse,
    EmployeeProfileUpdate,
    EmploymentCreate,
    EmploymentResponse,
    EmploymentUpdate,
    GoalCreate,
    GoalResponse,
    KpiCreate,
    KpiResponse,
    KpiUpdate,
    OkrCreate,
    OkrKeyResultIn,
    OkrResponse,
    OkrUpdate,
    GradeCreate,
    GradeResponse,
    GradeUpdate,
    HolidayCalendarCreate,
    HolidayCalendarResponse,
    HolidayCalendarUpdate,
    HrEssInboxItemResponse,
    JobLevelCreate,
    JobLevelResponse,
    JobLevelUpdate,
    LeaveAdjustmentCreate,
    LeaveAdjustmentResponse,
    LeaveApproveRequest,
    LeaveBalanceCreate,
    LeaveBalanceResponse,
    LeaveBalanceUpdate,
    CompOffCreditRequest,
    CarryForwardRequest,
    CarryForwardResponse,
    LeaveRequestCreate,
    LeaveRequestResponse,
    LeaveTypeCreate,
    LeaveTypeResponse,
    LeaveTypeUpdate,
    LifecycleEventResponse,
    ManagementGroupCreate,
    ManagementGroupResponse,
    ManagementGroupUpdate,
    EmployeeFeatureAccessResponse,
    OnDutyRequestCreate,
    OnDutyRequestResponse,
    OtAllotmentCreate,
    OtAllotmentResponse,
    CompoffRequestCreate,
    CompoffRequestResponse,
    BiometricDeviceCreate,
    BiometricDeviceFeedResponse,
    BiometricDeviceResponse,
    DeviceSyncRequest,
    DeviceSyncResponse,
    ShiftRotationCreate,
    ShiftRotationResponse,
    ShiftSwapCreate,
    ShiftSwapResponse,
    PerformanceReviewCreate,
    PerformanceReviewResponse,
    ProbationExtendRequest,
    ProbationStartRequest,
    EmploymentActivateRequest,
    ReportSummaryResponse,
    RosterEntryCreate,
    RosterEntryResponse,
    RosterEntryUpdate,
    SeparationApproveRequest,
    SeparationCompleteRequest,
    SeparationChecklistUpdate,
    SeparationCreate,
    SeparationExitInterviewRequest,
    SeparationResponse,
    ShiftAssignmentCreate,
    ShiftAssignmentResponse,
    ShiftAssignmentUpdate,
    ShiftCreate,
    ShiftResponse,
    ShiftUpdate,
    TrainingAssignRequest,
    TrainingAttendanceResponse,
    TrainingCreate,
    TrainingRequestCreate,
    TrainingRequestDecision,
    TrainingRequestResponse,
    TrainingResponse,
    TrainingRoomCreate,
    TrainingRoomResponse,
    TrainingRoomUpdate,
    TrainingUpdate,
    WeeklyOffPolicyCreate,
    WeeklyOffPolicyResponse,
    WeeklyOffPolicyUpdate,
    WeeklyOffRulesUpsert,
)
from modules.hr.service import (
    AppraisalService,
    AttendanceCorrectionService,
    AttendanceService,
    DepartmentAssignmentService,
    DesignationAssignmentService,
    DesignationService,
    EmployeeDocumentService,
    EmployeeProfileService,
    EmploymentService,
    GoalService,
    HolidayCalendarService,
    HRReportService,
    LeaveAdjustmentService,
    LeaveBalanceService,
    LeaveRequestService,
    LeaveTypeService,
    PerformanceService,
    RosterEntryService,
    SeparationService,
    ShiftAssignmentService,
    ShiftService,
    TrainingAttendanceService,
    TrainingRequestService,
    TrainingRoomService,
    TrainingService,
)
from modules.hr.service.attendance_policy_service import (
    AttendanceRuleService,
    WeeklyOffPolicyService,
)
from modules.hr.service.on_duty_ot_service import OnDutyRequestService, OtAllotmentService
from modules.hr.service.compoff_bio_service import BiometricDeviceService, CompoffRequestService
from modules.hr.service.shift_swap_rotation_service import ShiftRotationService, ShiftSwapService
from modules.hr.service.management_group_service import ManagementGroupService
from shared.schemas import APIResponse

designations_router = APIRouter(prefix="/designations", tags=["HR - Designations"])
employee_profiles_router = APIRouter(prefix="/employee-profiles", tags=["HR - Employee Profiles"])
employment_router = APIRouter(prefix="/employment", tags=["HR - Employment"])
management_groups_router = APIRouter(prefix="/management-groups", tags=["HR - Management Groups"])
department_assignments_router = APIRouter(prefix="/department-assignments", tags=["HR - Department Assignments"])
designation_assignments_router = APIRouter(prefix="/designation-assignments", tags=["HR - Designation Assignments"])
shifts_router = APIRouter(prefix="/shifts", tags=["HR - Shifts"])
shift_assignments_router = APIRouter(prefix="/shift-assignments", tags=["HR - Shift Assignments"])
roster_entries_router = APIRouter(prefix="/roster-entries", tags=["HR - Roster Entries"])
holiday_calendars_router = APIRouter(prefix="/holiday-calendars", tags=["HR - Holiday Calendars"])
leave_types_router = APIRouter(prefix="/leave-types", tags=["HR - Leave Types"])
leave_balances_router = APIRouter(prefix="/leave-balances", tags=["HR - Leave Balances"])
_require_leave_balance_manage = require_any_permission(
    "hr.leave:update",
    "hr.leave:approve",
    "hr.leave:create",
)
leave_requests_router = APIRouter(prefix="/leave-requests", tags=["HR - Leave Requests"])
leave_adjustments_router = APIRouter(prefix="/leave-adjustments", tags=["HR - Leave Adjustments"])
attendance_router = APIRouter(prefix="/attendance", tags=["HR - Attendance"])
attendance_corrections_router = APIRouter(
    prefix="/attendance-corrections", tags=["HR - Attendance Corrections"]
)
weekly_off_policies_router = APIRouter(
    prefix="/weekly-off-policies", tags=["HR - Weekly Off Policies"]
)
attendance_rules_router = APIRouter(
    prefix="/attendance-rules", tags=["HR - Attendance Rules"]
)
on_duty_router = APIRouter(prefix="/on-duty-requests", tags=["HR - On Duty"])
ot_allotments_router = APIRouter(prefix="/ot-allotments", tags=["HR - OT Allotments"])
compoff_requests_router = APIRouter(prefix="/compoff-requests", tags=["HR - Comp Off Requests"])
biometric_devices_router = APIRouter(prefix="/biometric-devices", tags=["HR - Biometric Devices"])
shift_rotations_router = APIRouter(prefix="/shift-rotations", tags=["HR - Shift Rotations"])
shift_swaps_router = APIRouter(prefix="/shift-swaps", tags=["HR - Shift Swaps"])
employee_documents_router = APIRouter(prefix="/employee-documents", tags=["HR - Employee Documents"])
performance_reviews_router = APIRouter(prefix="/performance-reviews", tags=["HR - Performance Reviews"])
goals_router = APIRouter(prefix="/goals", tags=["HR - Goals"])
kpis_router = APIRouter(prefix="/kpis", tags=["HR - KPIs"])
okrs_router = APIRouter(prefix="/okrs", tags=["HR - OKRs"])
appraisals_router = APIRouter(prefix="/appraisals", tags=["HR - Appraisals"])
training_router = APIRouter(prefix="/training", tags=["HR - Training"])
training_attendance_router = APIRouter(prefix="/training-attendance", tags=["HR - Training Attendance"])
training_rooms_router = APIRouter(prefix="/training-rooms", tags=["HR - Training Rooms"])
training_requests_router = APIRouter(prefix="/training-requests", tags=["HR - Training Requests"])
separation_router = APIRouter(prefix="/separation", tags=["HR - Separation"])
reports_router = APIRouter(prefix="/reports", tags=["HR - Reports"])
ess_inbox_router = APIRouter(prefix="/ess-inbox", tags=["HR - ESS Inbox"])


@designations_router.get("", response_model=APIResponse[list[DesignationResponse]])
def list_designations(
    ctx: Annotated[TenantContext, Depends(require_permission("hr.designation:read"))],
    db: Annotated[Session, Depends(get_db)],
    pagination: Annotated[PaginationParams, Depends(get_pagination)],
    company_id: UUID | None = None,
):
    return APIResponse(message="OK", data=paginate(DesignationService(db).list(ctx, company_id), pagination))


@designations_router.post("", response_model=APIResponse[DesignationResponse])
def create_designation(
    body: DesignationCreate,
    ctx: Annotated[TenantContext, Depends(require_permission("hr.designation:create"))],
    db: Annotated[Session, Depends(get_db)],
):
    return APIResponse(message="OK", data=DesignationService(db).create(ctx, **body.model_dump()))


@designations_router.patch("/{row_id}", response_model=APIResponse[DesignationResponse])
def update_designation(
    row_id: UUID,
    body: DesignationUpdate,
    ctx: Annotated[TenantContext, Depends(require_permission("hr.designation:update"))],
    db: Annotated[Session, Depends(get_db)],
):
    return APIResponse(message="OK", data=DesignationService(db).update(ctx, row_id, **extract_update_fields(body)))


@designations_router.delete("/{row_id}", response_model=APIResponse[None])
def delete_designation(
    row_id: UUID,
    ctx: Annotated[TenantContext, Depends(require_permission("hr.designation:update"))],
    db: Annotated[Session, Depends(get_db)],
):
    DesignationService(db).delete(ctx, row_id)
    return APIResponse(message="Deleted", data=None)


@employee_profiles_router.get("", response_model=APIResponse[list[EmployeeProfileResponse]])
def list_profiles(
    ctx: Annotated[TenantContext, Depends(require_permission("hr.employee_profile:read"))],
    db: Annotated[Session, Depends(get_db)],
    pagination: Annotated[PaginationParams, Depends(get_pagination)],
    company_id: UUID | None = None,
):
    return APIResponse(message="OK", data=paginate(EmployeeProfileService(db).list(ctx, company_id), pagination))


@employee_profiles_router.post("", response_model=APIResponse[EmployeeProfileResponse])
def create_profile(
    body: EmployeeProfileCreate,
    ctx: Annotated[TenantContext, Depends(require_permission("hr.employee_profile:create"))],
    db: Annotated[Session, Depends(get_db)],
):
    return APIResponse(message="OK", data=EmployeeProfileService(db).create(ctx, **body.model_dump()))


@employee_profiles_router.patch("/{row_id}", response_model=APIResponse[EmployeeProfileResponse])
def update_profile(
    row_id: UUID,
    body: EmployeeProfileUpdate,
    ctx: Annotated[TenantContext, Depends(require_permission("hr.employee_profile:update"))],
    db: Annotated[Session, Depends(get_db)],
):
    return APIResponse(message="OK", data=EmployeeProfileService(db).update(ctx, row_id, **extract_update_fields(body)))


@employee_profiles_router.post(
    "/force-password-reset/{employee_id}",
    response_model=APIResponse[dict],
)
def force_ess_password_reset(
    employee_id: UUID,
    ctx: Annotated[TenantContext, Depends(require_permission("hr.employee_profile:update"))],
    db: Annotated[Session, Depends(get_db)],
):
    from modules.hr.service.ess_password_admin import force_ess_password_reset as _force

    data = _force(db, ctx, employee_id)
    db.commit()
    return APIResponse(message="Employee must change password on next ESS login", data=data)


@management_groups_router.get("/feature-catalog", response_model=APIResponse[list[dict]])
def management_group_feature_catalog(
    ctx: Annotated[TenantContext, Depends(require_permission("hr.management_group:read"))],
    db: Annotated[Session, Depends(get_db)],
):
    return APIResponse(message="OK", data=ManagementGroupService(db).feature_catalog())


@management_groups_router.get("", response_model=APIResponse[list[ManagementGroupResponse]])
def list_management_groups(
    ctx: Annotated[TenantContext, Depends(require_permission("hr.management_group:read"))],
    db: Annotated[Session, Depends(get_db)],
    company_id: UUID | None = None,
):
    svc = ManagementGroupService(db)
    rows = svc.list(ctx, company_id)
    return APIResponse(
        message="OK",
        data=[ManagementGroupResponse.model_validate(svc.serialize(ctx, r)) for r in rows],
    )


@management_groups_router.post("", response_model=APIResponse[ManagementGroupResponse])
def create_management_group(
    body: ManagementGroupCreate,
    ctx: Annotated[TenantContext, Depends(require_permission("hr.management_group:create"))],
    db: Annotated[Session, Depends(get_db)],
):
    svc = ManagementGroupService(db)
    row = svc.create(ctx, **body.model_dump())
    return APIResponse(message="OK", data=ManagementGroupResponse.model_validate(svc.serialize(ctx, row)))


@management_groups_router.patch("/{row_id}", response_model=APIResponse[ManagementGroupResponse])
def update_management_group(
    row_id: UUID,
    body: ManagementGroupUpdate,
    ctx: Annotated[TenantContext, Depends(require_permission("hr.management_group:update"))],
    db: Annotated[Session, Depends(get_db)],
):
    svc = ManagementGroupService(db)
    row = svc.update(ctx, row_id, **extract_update_fields(body))
    return APIResponse(message="OK", data=ManagementGroupResponse.model_validate(svc.serialize(ctx, row)))


@management_groups_router.delete("/{row_id}", response_model=APIResponse[None])
def delete_management_group(
    row_id: UUID,
    ctx: Annotated[TenantContext, Depends(require_permission("hr.management_group:update"))],
    db: Annotated[Session, Depends(get_db)],
):
    ManagementGroupService(db).delete(ctx, row_id)
    return APIResponse(message="Deleted", data=None)


@management_groups_router.get(
    "/employees/{employee_id}/features",
    response_model=APIResponse[EmployeeFeatureAccessResponse],
)
def employee_feature_access(
    employee_id: UUID,
    ctx: Annotated[TenantContext, Depends(require_permission("hr.employment:read"))],
    db: Annotated[Session, Depends(get_db)],
):
    svc = ManagementGroupService(db)
    return APIResponse(message="OK", data=svc.employee_feature_access(ctx, employee_id))


@employment_router.get("", response_model=APIResponse[list[EmploymentResponse]])
def list_employment(
    ctx: Annotated[TenantContext, Depends(require_permission("hr.employment:read"))],
    db: Annotated[Session, Depends(get_db)],
    pagination: Annotated[PaginationParams, Depends(get_pagination)],
    company_id: UUID | None = None,
):
    return APIResponse(message="OK", data=paginate(EmploymentService(db).list(ctx, company_id), pagination))


@employment_router.post("", response_model=APIResponse[EmploymentResponse])
def create_employment(
    body: EmploymentCreate,
    ctx: Annotated[TenantContext, Depends(require_permission("hr.employment:create"))],
    db: Annotated[Session, Depends(get_db)],
):
    return APIResponse(message="OK", data=EmploymentService(db).create(ctx, **body.model_dump()))


@employment_router.patch("/{row_id}", response_model=APIResponse[EmploymentResponse])
def update_employment(
    row_id: UUID,
    body: EmploymentUpdate,
    ctx: Annotated[TenantContext, Depends(require_permission("hr.employment:update"))],
    db: Annotated[Session, Depends(get_db)],
):
    return APIResponse(message="OK", data=EmploymentService(db).update(ctx, row_id, **extract_update_fields(body)))


@employment_router.post("/{row_id}/start-onboarding", response_model=APIResponse[EmploymentResponse])
def start_onboarding_employment(
    row_id: UUID,
    ctx: Annotated[TenantContext, Depends(require_permission("hr.employment:update"))],
    db: Annotated[Session, Depends(get_db)],
):
    return APIResponse(message="OK", data=EmploymentService(db).start_onboarding(ctx, row_id))


@employment_router.post("/{row_id}/start-probation", response_model=APIResponse[EmploymentResponse])
def start_probation_employment(
    row_id: UUID,
    body: ProbationStartRequest,
    ctx: Annotated[TenantContext, Depends(require_permission("hr.employment:confirm"))],
    db: Annotated[Session, Depends(get_db)],
):
    return APIResponse(
        message="OK",
        data=EmploymentService(db).start_probation(ctx, row_id, probation_days=body.probation_days),
    )


@employment_router.post("/{row_id}/activate", response_model=APIResponse[EmploymentResponse])
def activate_employment(
    row_id: UUID,
    ctx: Annotated[TenantContext, Depends(require_permission("hr.employment:update"))],
    db: Annotated[Session, Depends(get_db)],
    body: EmploymentActivateRequest | None = None,
):
    payload = body or EmploymentActivateRequest()
    return APIResponse(
        message="OK",
        data=EmploymentService(db).activate(
            ctx,
            row_id,
            employee_code=payload.employee_code,
            shift_id=payload.shift_id,
            start_probation=payload.start_probation,
            probation_days=payload.probation_days,
            mark_payroll_eligible=payload.mark_payroll_eligible,
        ),
    )


@employment_router.post("/{row_id}/confirm", response_model=APIResponse[EmploymentResponse])
def confirm_employment(
    row_id: UUID,
    ctx: Annotated[TenantContext, Depends(require_permission("hr.employment:confirm"))],
    db: Annotated[Session, Depends(get_db)],
):
    return APIResponse(message="OK", data=EmploymentService(db).confirm(ctx, row_id))


@employment_router.post("/{row_id}/extend-probation", response_model=APIResponse[EmploymentResponse])
def extend_probation_employment(
    row_id: UUID,
    body: ProbationExtendRequest,
    ctx: Annotated[TenantContext, Depends(require_permission("hr.employment:confirm"))],
    db: Annotated[Session, Depends(get_db)],
):
    return APIResponse(
        message="OK",
        data=EmploymentService(db).extend_probation(ctx, row_id, extra_days=body.extra_days),
    )


@employment_router.post("/{row_id}/start-notice", response_model=APIResponse[EmploymentResponse])
def start_notice_employment(
    row_id: UUID,
    ctx: Annotated[TenantContext, Depends(require_permission("hr.employment:update"))],
    db: Annotated[Session, Depends(get_db)],
):
    return APIResponse(message="OK", data=EmploymentService(db).start_notice(ctx, row_id))


@employment_router.post("/{row_id}/separate", response_model=APIResponse[EmploymentResponse])
def separate_employment(
    row_id: UUID,
    ctx: Annotated[TenantContext, Depends(require_permission("hr.employment:update"))],
    db: Annotated[Session, Depends(get_db)],
):
    return APIResponse(message="OK", data=EmploymentService(db).mark_separated(ctx, row_id))


@employment_router.post("/{row_id}/ex-employee", response_model=APIResponse[EmploymentResponse])
def ex_employee_employment(
    row_id: UUID,
    ctx: Annotated[TenantContext, Depends(require_permission("hr.employment:update"))],
    db: Annotated[Session, Depends(get_db)],
):
    return APIResponse(message="OK", data=EmploymentService(db).mark_ex_employee(ctx, row_id))


@employment_router.post("/{row_id}/end", response_model=APIResponse[EmploymentResponse])
def end_employment(
    row_id: UUID,
    ctx: Annotated[TenantContext, Depends(require_permission("hr.employment:update"))],
    db: Annotated[Session, Depends(get_db)],
):
    return APIResponse(message="OK", data=EmploymentService(db).end(ctx, row_id))


@employment_router.get("/lifecycle/{employee_id}", response_model=APIResponse[list[LifecycleEventResponse]])
def list_lifecycle_events(
    employee_id: UUID,
    ctx: Annotated[TenantContext, Depends(require_permission("hr.employment:read"))],
    db: Annotated[Session, Depends(get_db)],
):
    return APIResponse(message="OK", data=EmploymentService(db).list_lifecycle(ctx, employee_id))


@department_assignments_router.get("", response_model=APIResponse[list[DepartmentAssignmentResponse]])
def list_dept_asg(
    ctx: Annotated[TenantContext, Depends(require_permission("hr.employment:read"))],
    db: Annotated[Session, Depends(get_db)],
    pagination: Annotated[PaginationParams, Depends(get_pagination)],
    company_id: UUID | None = None,
):
    return APIResponse(message="OK", data=paginate(DepartmentAssignmentService(db).list(ctx, company_id), pagination))


@department_assignments_router.post("", response_model=APIResponse[DepartmentAssignmentResponse])
def create_dept_asg(
    body: DepartmentAssignmentCreate,
    ctx: Annotated[TenantContext, Depends(require_permission("hr.employment:create"))],
    db: Annotated[Session, Depends(get_db)],
):
    return APIResponse(message="OK", data=DepartmentAssignmentService(db).create(ctx, **body.model_dump()))


@designation_assignments_router.get("", response_model=APIResponse[list[DesignationAssignmentResponse]])
def list_desig_asg(
    ctx: Annotated[TenantContext, Depends(require_permission("hr.employment:read"))],
    db: Annotated[Session, Depends(get_db)],
    pagination: Annotated[PaginationParams, Depends(get_pagination)],
    company_id: UUID | None = None,
):
    return APIResponse(message="OK", data=paginate(DesignationAssignmentService(db).list(ctx, company_id), pagination))


@designation_assignments_router.post("", response_model=APIResponse[DesignationAssignmentResponse])
def create_desig_asg(
    body: DesignationAssignmentCreate,
    ctx: Annotated[TenantContext, Depends(require_permission("hr.employment:create"))],
    db: Annotated[Session, Depends(get_db)],
):
    return APIResponse(message="OK", data=DesignationAssignmentService(db).create(ctx, **body.model_dump()))


@shifts_router.get("", response_model=APIResponse[list[ShiftResponse]])
def list_shifts(
    ctx: Annotated[TenantContext, Depends(require_permission("hr.shift:read"))],
    db: Annotated[Session, Depends(get_db)],
    pagination: Annotated[PaginationParams, Depends(get_pagination)],
    company_id: UUID | None = None,
):
    return APIResponse(message="OK", data=paginate(ShiftService(db).list(ctx, company_id), pagination))


@shifts_router.post("", response_model=APIResponse[ShiftResponse])
def create_shift(
    body: ShiftCreate,
    ctx: Annotated[TenantContext, Depends(require_permission("hr.shift:create"))],
    db: Annotated[Session, Depends(get_db)],
):
    return APIResponse(message="OK", data=ShiftService(db).create(ctx, **body.model_dump()))


@shifts_router.patch("/{row_id}", response_model=APIResponse[ShiftResponse])
def update_shift(
    row_id: UUID,
    body: ShiftUpdate,
    ctx: Annotated[TenantContext, Depends(require_permission("hr.shift:update"))],
    db: Annotated[Session, Depends(get_db)],
):
    return APIResponse(message="OK", data=ShiftService(db).update(ctx, row_id, **extract_update_fields(body)))


@shift_assignments_router.get("", response_model=APIResponse[list[ShiftAssignmentResponse]])
def list_sfa(
    ctx: Annotated[TenantContext, Depends(require_permission("hr.shift_assignment:read"))],
    db: Annotated[Session, Depends(get_db)],
    pagination: Annotated[PaginationParams, Depends(get_pagination)],
    company_id: UUID | None = None,
):
    return APIResponse(message="OK", data=paginate(ShiftAssignmentService(db).list(ctx, company_id), pagination))


@shift_assignments_router.get("/{row_id}", response_model=APIResponse[ShiftAssignmentResponse])
def get_sfa(
    row_id: UUID,
    ctx: Annotated[TenantContext, Depends(require_permission("hr.shift_assignment:read"))],
    db: Annotated[Session, Depends(get_db)],
):
    return APIResponse(message="OK", data=ShiftAssignmentService(db).get(ctx, row_id))


@shift_assignments_router.post("", response_model=APIResponse[ShiftAssignmentResponse])
def create_sfa(
    body: ShiftAssignmentCreate,
    ctx: Annotated[TenantContext, Depends(require_permission("hr.shift_assignment:create"))],
    db: Annotated[Session, Depends(get_db)],
):
    return APIResponse(message="OK", data=ShiftAssignmentService(db).create(ctx, **body.model_dump()))


@shift_assignments_router.patch("/{row_id}", response_model=APIResponse[ShiftAssignmentResponse])
def update_sfa(
    row_id: UUID,
    body: ShiftAssignmentUpdate,
    ctx: Annotated[TenantContext, Depends(require_permission("hr.shift_assignment:create"))],
    db: Annotated[Session, Depends(get_db)],
):
    return APIResponse(
        message="OK",
        data=ShiftAssignmentService(db).update(ctx, row_id, **extract_update_fields(body)),
    )


@shift_assignments_router.post("/{row_id}/submit", response_model=APIResponse[ShiftAssignmentResponse])
def submit_sfa(
    row_id: UUID,
    ctx: Annotated[TenantContext, Depends(require_permission("hr.shift_assignment:submit"))],
    db: Annotated[Session, Depends(get_db)],
):
    return APIResponse(message="OK", data=ShiftAssignmentService(db).submit(ctx, row_id))


@shift_assignments_router.post("/{row_id}/approve", response_model=APIResponse[ShiftAssignmentResponse])
def approve_sfa(
    row_id: UUID,
    ctx: Annotated[TenantContext, Depends(require_permission("hr.shift_assignment:approve"))],
    db: Annotated[Session, Depends(get_db)],
):
    return APIResponse(message="OK", data=ShiftAssignmentService(db).approve(ctx, row_id))


@shift_assignments_router.delete("/{row_id}", response_model=APIResponse[None])
def delete_sfa(
    row_id: UUID,
    ctx: Annotated[TenantContext, Depends(require_permission("hr.shift_assignment:create"))],
    db: Annotated[Session, Depends(get_db)],
):
    ShiftAssignmentService(db).delete(ctx, row_id)
    return APIResponse(message="Shift assignment deleted", data=None)


@roster_entries_router.get("", response_model=APIResponse[list[RosterEntryResponse]])
def list_roster_entries(
    ctx: Annotated[TenantContext, Depends(require_permission("hr.shift_assignment:read"))],
    db: Annotated[Session, Depends(get_db)],
    pagination: Annotated[PaginationParams, Depends(get_pagination)],
    company_id: UUID | None = None,
):
    return APIResponse(
        message="OK",
        data=paginate(RosterEntryService(db).list(ctx, company_id), pagination),
    )


@roster_entries_router.get("/{row_id}", response_model=APIResponse[RosterEntryResponse])
def get_roster_entry(
    row_id: UUID,
    ctx: Annotated[TenantContext, Depends(require_permission("hr.shift_assignment:read"))],
    db: Annotated[Session, Depends(get_db)],
):
    return APIResponse(message="OK", data=RosterEntryService(db).get(ctx, row_id))


@roster_entries_router.post("", response_model=APIResponse[RosterEntryResponse])
def create_roster_entry(
    body: RosterEntryCreate,
    ctx: Annotated[TenantContext, Depends(require_permission("hr.shift_assignment:create"))],
    db: Annotated[Session, Depends(get_db)],
):
    return APIResponse(message="OK", data=RosterEntryService(db).create(ctx, **body.model_dump()))


@roster_entries_router.patch("/{row_id}", response_model=APIResponse[RosterEntryResponse])
def update_roster_entry(
    row_id: UUID,
    body: RosterEntryUpdate,
    ctx: Annotated[TenantContext, Depends(require_permission("hr.shift_assignment:create"))],
    db: Annotated[Session, Depends(get_db)],
):
    return APIResponse(
        message="OK",
        data=RosterEntryService(db).update(ctx, row_id, **extract_update_fields(body)),
    )


@roster_entries_router.delete("/{row_id}", response_model=APIResponse[None])
def delete_roster_entry(
    row_id: UUID,
    ctx: Annotated[TenantContext, Depends(require_permission("hr.shift_assignment:create"))],
    db: Annotated[Session, Depends(get_db)],
):
    RosterEntryService(db).delete(ctx, row_id)
    return APIResponse(message="Roster entry deleted", data=None)


@holiday_calendars_router.get("", response_model=APIResponse[list[HolidayCalendarResponse]])
def list_holidays(
    ctx: Annotated[TenantContext, Depends(require_permission("hr.holiday_calendar:read"))],
    db: Annotated[Session, Depends(get_db)],
    pagination: Annotated[PaginationParams, Depends(get_pagination)],
    company_id: UUID | None = None,
):
    return APIResponse(message="OK", data=paginate(HolidayCalendarService(db).list(ctx, company_id), pagination))


@holiday_calendars_router.post("", response_model=APIResponse[HolidayCalendarResponse])
def create_holiday(
    body: HolidayCalendarCreate,
    ctx: Annotated[TenantContext, Depends(require_permission("hr.holiday_calendar:create"))],
    db: Annotated[Session, Depends(get_db)],
):
    return APIResponse(message="OK", data=HolidayCalendarService(db).create(ctx, **body.model_dump()))


@holiday_calendars_router.patch("/{row_id}", response_model=APIResponse[HolidayCalendarResponse])
def update_holiday(
    row_id: UUID,
    body: HolidayCalendarUpdate,
    ctx: Annotated[TenantContext, Depends(require_permission("hr.holiday_calendar:update"))],
    db: Annotated[Session, Depends(get_db)],
):
    return APIResponse(message="OK", data=HolidayCalendarService(db).update(ctx, row_id, **extract_update_fields(body)))


@holiday_calendars_router.post("/{row_id}/publish", response_model=APIResponse[HolidayCalendarResponse])
def publish_holiday(
    row_id: UUID,
    ctx: Annotated[TenantContext, Depends(require_permission("hr.holiday_calendar:update"))],
    db: Annotated[Session, Depends(get_db)],
):
    return APIResponse(message="OK", data=HolidayCalendarService(db).publish(ctx, row_id))


@holiday_calendars_router.post("/{row_id}/archive", response_model=APIResponse[HolidayCalendarResponse])
def archive_holiday(
    row_id: UUID,
    ctx: Annotated[TenantContext, Depends(require_permission("hr.holiday_calendar:update"))],
    db: Annotated[Session, Depends(get_db)],
):
    return APIResponse(message="OK", data=HolidayCalendarService(db).archive(ctx, row_id))


@holiday_calendars_router.delete("/{row_id}", response_model=APIResponse[None])
def delete_holiday(
    row_id: UUID,
    ctx: Annotated[TenantContext, Depends(require_permission("hr.holiday_calendar:update"))],
    db: Annotated[Session, Depends(get_db)],
):
    HolidayCalendarService(db).delete(ctx, row_id)
    return APIResponse(message="Holiday calendar deleted", data=None)


@leave_types_router.get("", response_model=APIResponse[list[LeaveTypeResponse]])
def list_leave_types(
    ctx: Annotated[TenantContext, Depends(require_permission("hr.leave_type:read"))],
    db: Annotated[Session, Depends(get_db)],
    pagination: Annotated[PaginationParams, Depends(get_pagination)],
    company_id: UUID | None = None,
):
    return APIResponse(message="OK", data=paginate(LeaveTypeService(db).list(ctx, company_id), pagination))


@leave_types_router.post("", response_model=APIResponse[LeaveTypeResponse])
def create_leave_type(
    body: LeaveTypeCreate,
    ctx: Annotated[TenantContext, Depends(require_permission("hr.leave_type:create"))],
    db: Annotated[Session, Depends(get_db)],
):
    return APIResponse(message="OK", data=LeaveTypeService(db).create(ctx, **body.model_dump()))


@leave_types_router.patch("/{row_id}", response_model=APIResponse[LeaveTypeResponse])
def update_leave_type(
    row_id: UUID,
    body: LeaveTypeUpdate,
    ctx: Annotated[TenantContext, Depends(require_permission("hr.leave_type:update"))],
    db: Annotated[Session, Depends(get_db)],
):
    return APIResponse(message="OK", data=LeaveTypeService(db).update(ctx, row_id, **extract_update_fields(body)))


@leave_types_router.delete("/{row_id}", response_model=APIResponse[None])
def delete_leave_type(
    row_id: UUID,
    ctx: Annotated[TenantContext, Depends(require_permission("hr.leave_type:update"))],
    db: Annotated[Session, Depends(get_db)],
):
    message = LeaveTypeService(db).delete(ctx, row_id)
    return APIResponse(message=message, data=None)


@leave_balances_router.get("", response_model=APIResponse[list[LeaveBalanceResponse]])
def list_balances(
    ctx: Annotated[TenantContext, Depends(require_permission("hr.leave:read"))],
    db: Annotated[Session, Depends(get_db)],
    pagination: Annotated[PaginationParams, Depends(get_pagination)],
    company_id: UUID | None = None,
):
    return APIResponse(message="OK", data=paginate(LeaveBalanceService(db).list(ctx, company_id), pagination))


@leave_balances_router.post("", response_model=APIResponse[LeaveBalanceResponse])
def create_balance(
    body: LeaveBalanceCreate,
    ctx: Annotated[TenantContext, Depends(_require_leave_balance_manage)],
    db: Annotated[Session, Depends(get_db)],
):
    return APIResponse(message="OK", data=LeaveBalanceService(db).create(ctx, **body.model_dump()))


@leave_balances_router.patch("/{row_id}", response_model=APIResponse[LeaveBalanceResponse])
def update_balance(
    row_id: UUID,
    body: LeaveBalanceUpdate,
    ctx: Annotated[TenantContext, Depends(_require_leave_balance_manage)],
    db: Annotated[Session, Depends(get_db)],
):
    return APIResponse(
        message="OK",
        data=LeaveBalanceService(db).update(ctx, row_id, **extract_update_fields(body)),
    )


@leave_balances_router.delete("/{row_id}", response_model=APIResponse[None])
def delete_balance(
    row_id: UUID,
    ctx: Annotated[TenantContext, Depends(_require_leave_balance_manage)],
    db: Annotated[Session, Depends(get_db)],
):
    LeaveBalanceService(db).delete(ctx, row_id)
    return APIResponse(message="Leave balance removed", data=None)


@leave_balances_router.post("/compoff-credit", response_model=APIResponse[LeaveBalanceResponse])
def credit_compoff(
    body: CompOffCreditRequest,
    ctx: Annotated[TenantContext, Depends(require_permission("hr.leave:create"))],
    db: Annotated[Session, Depends(get_db)],
):
    return APIResponse(
        message="Comp off credited",
        data=LeaveBalanceService(db).credit_compoff(ctx, **body.model_dump()),
    )


@leave_balances_router.post("/carry-forward", response_model=APIResponse[CarryForwardResponse])
def carry_forward_balances(
    body: CarryForwardRequest,
    ctx: Annotated[TenantContext, Depends(require_permission("hr.leave:create"))],
    db: Annotated[Session, Depends(get_db)],
):
    result = LeaveBalanceService(db).carry_forward_year_end(ctx, **body.model_dump())
    return APIResponse(message="Carry forward applied", data=CarryForwardResponse(**result))


@leave_requests_router.get("", response_model=APIResponse[list[LeaveRequestResponse]])
def list_leave_requests(
    ctx: Annotated[TenantContext, Depends(require_permission("hr.leave:read"))],
    db: Annotated[Session, Depends(get_db)],
    pagination: Annotated[PaginationParams, Depends(get_pagination)],
    company_id: UUID | None = None,
):
    return APIResponse(message="OK", data=paginate(LeaveRequestService(db).list(ctx, company_id), pagination))


@leave_requests_router.post("", response_model=APIResponse[LeaveRequestResponse])
def create_leave_request(
    body: LeaveRequestCreate,
    ctx: Annotated[TenantContext, Depends(require_permission("hr.leave:create"))],
    db: Annotated[Session, Depends(get_db)],
):
    return APIResponse(message="OK", data=LeaveRequestService(db).create(ctx, **body.model_dump()))


@leave_requests_router.post("/{row_id}/submit", response_model=APIResponse[LeaveRequestResponse])
def submit_leave(
    row_id: UUID,
    ctx: Annotated[TenantContext, Depends(require_permission("hr.leave:submit"))],
    db: Annotated[Session, Depends(get_db)],
):
    return APIResponse(message="OK", data=LeaveRequestService(db).submit(ctx, row_id))


@leave_requests_router.post("/{row_id}/approve", response_model=APIResponse[LeaveRequestResponse])
def approve_leave(
    row_id: UUID,
    body: LeaveApproveRequest,
    ctx: Annotated[TenantContext, Depends(require_permission("hr.leave:approve"))],
    db: Annotated[Session, Depends(get_db)],
):
    return APIResponse(message="OK", data=LeaveRequestService(db).approve(ctx, row_id, **body.model_dump()))


@leave_requests_router.post("/{row_id}/manager-approve", response_model=APIResponse[LeaveRequestResponse])
def manager_approve_leave(
    row_id: UUID,
    body: LeaveApproveRequest,
    ctx: Annotated[TenantContext, Depends(require_permission("hr.leave:approve"))],
    db: Annotated[Session, Depends(get_db)],
):
    return APIResponse(
        message="OK",
        data=LeaveRequestService(db).manager_approve(ctx, row_id, **body.model_dump()),
    )


@leave_requests_router.post("/{row_id}/reject", response_model=APIResponse[LeaveRequestResponse])
def reject_leave(
    row_id: UUID,
    body: LeaveApproveRequest,
    ctx: Annotated[TenantContext, Depends(require_permission("hr.leave:approve"))],
    db: Annotated[Session, Depends(get_db)],
):
    return APIResponse(message="OK", data=LeaveRequestService(db).reject(ctx, row_id, **body.model_dump()))


@leave_adjustments_router.get("", response_model=APIResponse[list[LeaveAdjustmentResponse]])
def list_leave_adjustments(
    ctx: Annotated[TenantContext, Depends(require_permission("hr.leave:read"))],
    db: Annotated[Session, Depends(get_db)],
    pagination: Annotated[PaginationParams, Depends(get_pagination)],
    company_id: UUID | None = None,
):
    return APIResponse(
        message="OK",
        data=paginate(LeaveAdjustmentService(db).list(ctx, company_id), pagination),
    )


@leave_adjustments_router.post("", response_model=APIResponse[LeaveAdjustmentResponse])
def create_leave_adjustment(
    body: LeaveAdjustmentCreate,
    ctx: Annotated[TenantContext, Depends(require_permission("hr.leave:create"))],
    db: Annotated[Session, Depends(get_db)],
):
    return APIResponse(message="OK", data=LeaveAdjustmentService(db).create(ctx, **body.model_dump()))


@leave_adjustments_router.post("/apply", response_model=APIResponse[LeaveAdjustmentResponse])
def apply_leave_adjustment(
    body: LeaveAdjustmentCreate,
    ctx: Annotated[TenantContext, Depends(require_any_permission("hr.leave:approve", "hr.leave:update"))],
    db: Annotated[Session, Depends(get_db)],
):
    return APIResponse(
        message="Leave adjustment applied",
        data=LeaveAdjustmentService(db).create_and_apply(ctx, **body.model_dump(exclude={"status"})),
    )


@leave_adjustments_router.post("/{row_id}/submit", response_model=APIResponse[LeaveAdjustmentResponse])
def submit_leave_adjustment(
    row_id: UUID,
    ctx: Annotated[TenantContext, Depends(require_permission("hr.leave:submit"))],
    db: Annotated[Session, Depends(get_db)],
):
    return APIResponse(message="OK", data=LeaveAdjustmentService(db).submit(ctx, row_id))


@leave_adjustments_router.post("/{row_id}/approve", response_model=APIResponse[LeaveAdjustmentResponse])
def approve_leave_adjustment(
    row_id: UUID,
    ctx: Annotated[TenantContext, Depends(require_permission("hr.leave:approve"))],
    db: Annotated[Session, Depends(get_db)],
):
    return APIResponse(message="OK", data=LeaveAdjustmentService(db).approve(ctx, row_id))


@leave_adjustments_router.post("/{row_id}/reject", response_model=APIResponse[LeaveAdjustmentResponse])
def reject_leave_adjustment(
    row_id: UUID,
    ctx: Annotated[TenantContext, Depends(require_permission("hr.leave:approve"))],
    db: Annotated[Session, Depends(get_db)],
):
    return APIResponse(message="OK", data=LeaveAdjustmentService(db).reject(ctx, row_id))


@attendance_router.get("", response_model=APIResponse[list[AttendanceResponse]])
def list_attendance(
    ctx: Annotated[TenantContext, Depends(require_permission("hr.attendance:read"))],
    db: Annotated[Session, Depends(get_db)],
    pagination: Annotated[PaginationParams, Depends(get_pagination)],
    company_id: UUID | None = None,
):
    return APIResponse(message="OK", data=paginate(AttendanceService(db).list(ctx, company_id), pagination))


@attendance_router.post("", response_model=APIResponse[AttendanceResponse])
def create_attendance(
    body: AttendanceCreate,
    ctx: Annotated[TenantContext, Depends(require_permission("hr.attendance:create"))],
    db: Annotated[Session, Depends(get_db)],
):
    return APIResponse(message="OK", data=AttendanceService(db).create(ctx, **body.model_dump()))


@attendance_router.post("/jobs/auto-absent", response_model=APIResponse[dict])
def run_attendance_auto_absent(
    ctx: Annotated[TenantContext, Depends(require_permission("hr.attendance:update"))],
):
    """Run yesterday auto-absent / week-off / holiday backfill (same as Celery beat task)."""
    from modules.hr.tasks import attendance_auto_absent

    return APIResponse(message="OK", data=attendance_auto_absent())


@attendance_router.patch("/{row_id}", response_model=APIResponse[AttendanceResponse])
def update_attendance(
    row_id: UUID,
    body: AttendanceUpdate,
    ctx: Annotated[TenantContext, Depends(require_permission("hr.attendance:update"))],
    db: Annotated[Session, Depends(get_db)],
):
    return APIResponse(message="OK", data=AttendanceService(db).update(ctx, row_id, **extract_update_fields(body)))


@attendance_router.post("/{row_id}/lock", response_model=APIResponse[AttendanceResponse])
def lock_attendance(
    row_id: UUID,
    ctx: Annotated[TenantContext, Depends(require_permission("hr.attendance:lock"))],
    db: Annotated[Session, Depends(get_db)],
):
    return APIResponse(message="OK", data=AttendanceService(db).lock(ctx, row_id))


@attendance_corrections_router.get("", response_model=APIResponse[list[AttendanceCorrectionResponse]])
def list_attendance_corrections(
    ctx: Annotated[TenantContext, Depends(require_permission("hr.attendance:read"))],
    db: Annotated[Session, Depends(get_db)],
    pagination: Annotated[PaginationParams, Depends(get_pagination)],
    company_id: UUID | None = None,
):
    return APIResponse(
        message="OK",
        data=paginate(AttendanceCorrectionService(db).list(ctx, company_id), pagination),
    )


@attendance_corrections_router.post("", response_model=APIResponse[AttendanceCorrectionResponse])
def create_attendance_correction(
    body: AttendanceCorrectionCreate,
    ctx: Annotated[TenantContext, Depends(require_permission("hr.attendance:create"))],
    db: Annotated[Session, Depends(get_db)],
):
    return APIResponse(
        message="OK",
        data=AttendanceCorrectionService(db).create(ctx, **body.model_dump()),
    )


@attendance_corrections_router.post(
    "/{row_id}/submit", response_model=APIResponse[AttendanceCorrectionResponse]
)
def submit_attendance_correction(
    row_id: UUID,
    ctx: Annotated[TenantContext, Depends(require_permission("hr.attendance:create"))],
    db: Annotated[Session, Depends(get_db)],
):
    return APIResponse(message="OK", data=AttendanceCorrectionService(db).submit(ctx, row_id))


@attendance_corrections_router.post(
    "/{row_id}/approve", response_model=APIResponse[AttendanceCorrectionResponse]
)
def approve_attendance_correction(
    row_id: UUID,
    ctx: Annotated[TenantContext, Depends(require_permission("hr.attendance:update"))],
    db: Annotated[Session, Depends(get_db)],
):
    return APIResponse(message="OK", data=AttendanceCorrectionService(db).approve(ctx, row_id))


@attendance_corrections_router.post(
    "/{row_id}/reject", response_model=APIResponse[AttendanceCorrectionResponse]
)
def reject_attendance_correction(
    row_id: UUID,
    ctx: Annotated[TenantContext, Depends(require_permission("hr.attendance:update"))],
    db: Annotated[Session, Depends(get_db)],
):
    return APIResponse(message="OK", data=AttendanceCorrectionService(db).reject(ctx, row_id))


@weekly_off_policies_router.get("", response_model=APIResponse[list[WeeklyOffPolicyResponse]])
def list_weekly_off_policies(
    ctx: Annotated[TenantContext, Depends(require_permission("hr.attendance:read"))],
    db: Annotated[Session, Depends(get_db)],
    pagination: Annotated[PaginationParams, Depends(get_pagination)],
    company_id: UUID | None = None,
):
    return APIResponse(
        message="OK",
        data=paginate(WeeklyOffPolicyService(db).list(ctx, company_id), pagination),
    )


@weekly_off_policies_router.post("", response_model=APIResponse[WeeklyOffPolicyResponse])
def create_weekly_off_policy(
    body: WeeklyOffPolicyCreate,
    ctx: Annotated[TenantContext, Depends(require_permission("hr.attendance:create"))],
    db: Annotated[Session, Depends(get_db)],
):
    return APIResponse(
        message="OK",
        data=WeeklyOffPolicyService(db).create(ctx, **body.model_dump()),
    )


@weekly_off_policies_router.put("/rules", response_model=APIResponse[WeeklyOffPolicyResponse])
def upsert_weekly_off_rules(
    body: WeeklyOffRulesUpsert,
    ctx: Annotated[TenantContext, Depends(require_permission("hr.attendance:update"))],
    db: Annotated[Session, Depends(get_db)],
):
    return APIResponse(
        message="OK",
        data=WeeklyOffPolicyService(db).upsert_rules(
            ctx,
            body.rules_json,
            company_id=body.company_id,
            custom_weekdays=body.custom_weekdays_json,
            alternate_saturday_start=body.alternate_saturday_start,
        ),
    )


@weekly_off_policies_router.patch("/{row_id}", response_model=APIResponse[WeeklyOffPolicyResponse])
def update_weekly_off_policy(
    row_id: UUID,
    body: WeeklyOffPolicyUpdate,
    ctx: Annotated[TenantContext, Depends(require_permission("hr.attendance:update"))],
    db: Annotated[Session, Depends(get_db)],
):
    return APIResponse(
        message="OK",
        data=WeeklyOffPolicyService(db).update(ctx, row_id, **extract_update_fields(body)),
    )


@attendance_rules_router.get("", response_model=APIResponse[list[AttendanceRuleResponse]])
def list_attendance_rules(
    ctx: Annotated[TenantContext, Depends(require_permission("hr.attendance:read"))],
    db: Annotated[Session, Depends(get_db)],
    pagination: Annotated[PaginationParams, Depends(get_pagination)],
    company_id: UUID | None = None,
):
    return APIResponse(
        message="OK",
        data=paginate(AttendanceRuleService(db).list(ctx, company_id), pagination),
    )


@attendance_rules_router.post("", response_model=APIResponse[AttendanceRuleResponse])
def create_attendance_rule(
    body: AttendanceRuleCreate,
    ctx: Annotated[TenantContext, Depends(require_permission("hr.attendance:create"))],
    db: Annotated[Session, Depends(get_db)],
):
    payload = {k: v for k, v in body.model_dump().items() if v is not None}
    return APIResponse(message="OK", data=AttendanceRuleService(db).create(ctx, **payload))


@attendance_rules_router.patch("/{row_id}", response_model=APIResponse[AttendanceRuleResponse])
def update_attendance_rule(
    row_id: UUID,
    body: AttendanceRuleUpdate,
    ctx: Annotated[TenantContext, Depends(require_permission("hr.attendance:update"))],
    db: Annotated[Session, Depends(get_db)],
):
    return APIResponse(
        message="OK",
        data=AttendanceRuleService(db).update(ctx, row_id, **extract_update_fields(body)),
    )


@on_duty_router.get("", response_model=APIResponse[list[OnDutyRequestResponse]])
def list_on_duty(
    ctx: Annotated[TenantContext, Depends(require_permission("hr.attendance:read"))],
    db: Annotated[Session, Depends(get_db)],
    pagination: Annotated[PaginationParams, Depends(get_pagination)],
    company_id: UUID | None = None,
):
    return APIResponse(
        message="OK",
        data=paginate(OnDutyRequestService(db).list(ctx, company_id), pagination),
    )


@on_duty_router.post("", response_model=APIResponse[OnDutyRequestResponse])
def create_on_duty(
    body: OnDutyRequestCreate,
    ctx: Annotated[TenantContext, Depends(require_permission("hr.attendance:create"))],
    db: Annotated[Session, Depends(get_db)],
):
    payload = body.model_dump()
    status = payload.pop("status", None) or "draft"
    return APIResponse(
        message="OK",
        data=OnDutyRequestService(db).create(ctx, status=status, **payload),
    )


@on_duty_router.post("/{row_id}/submit", response_model=APIResponse[OnDutyRequestResponse])
def submit_on_duty(
    row_id: UUID,
    ctx: Annotated[TenantContext, Depends(require_permission("hr.attendance:update"))],
    db: Annotated[Session, Depends(get_db)],
):
    return APIResponse(message="OK", data=OnDutyRequestService(db).submit(ctx, row_id))


@on_duty_router.post("/{row_id}/approve", response_model=APIResponse[OnDutyRequestResponse])
def approve_on_duty(
    row_id: UUID,
    ctx: Annotated[TenantContext, Depends(require_permission("hr.attendance:update"))],
    db: Annotated[Session, Depends(get_db)],
):
    return APIResponse(message="OK", data=OnDutyRequestService(db).approve(ctx, row_id))


@on_duty_router.post("/{row_id}/reject", response_model=APIResponse[OnDutyRequestResponse])
def reject_on_duty(
    row_id: UUID,
    ctx: Annotated[TenantContext, Depends(require_permission("hr.attendance:update"))],
    db: Annotated[Session, Depends(get_db)],
):
    return APIResponse(message="OK", data=OnDutyRequestService(db).reject(ctx, row_id))


@ot_allotments_router.get("", response_model=APIResponse[list[OtAllotmentResponse]])
def list_ot_allotments(
    ctx: Annotated[TenantContext, Depends(require_permission("hr.attendance:read"))],
    db: Annotated[Session, Depends(get_db)],
    pagination: Annotated[PaginationParams, Depends(get_pagination)],
    company_id: UUID | None = None,
):
    return APIResponse(
        message="OK",
        data=paginate(OtAllotmentService(db).list(ctx, company_id), pagination),
    )


@ot_allotments_router.post("", response_model=APIResponse[OtAllotmentResponse])
def create_ot_allotment(
    body: OtAllotmentCreate,
    ctx: Annotated[TenantContext, Depends(require_permission("hr.attendance:create"))],
    db: Annotated[Session, Depends(get_db)],
):
    payload = body.model_dump()
    status = payload.pop("status", None) or "draft"
    return APIResponse(
        message="OK",
        data=OtAllotmentService(db).create(ctx, status=status, **payload),
    )


@ot_allotments_router.post("/{row_id}/submit", response_model=APIResponse[OtAllotmentResponse])
def submit_ot_allotment(
    row_id: UUID,
    ctx: Annotated[TenantContext, Depends(require_permission("hr.attendance:update"))],
    db: Annotated[Session, Depends(get_db)],
):
    return APIResponse(message="OK", data=OtAllotmentService(db).submit(ctx, row_id))


@ot_allotments_router.post("/{row_id}/approve", response_model=APIResponse[OtAllotmentResponse])
def approve_ot_allotment(
    row_id: UUID,
    ctx: Annotated[TenantContext, Depends(require_permission("hr.attendance:update"))],
    db: Annotated[Session, Depends(get_db)],
):
    return APIResponse(message="OK", data=OtAllotmentService(db).approve(ctx, row_id))


@ot_allotments_router.post("/{row_id}/reject", response_model=APIResponse[OtAllotmentResponse])
def reject_ot_allotment(
    row_id: UUID,
    ctx: Annotated[TenantContext, Depends(require_permission("hr.attendance:update"))],
    db: Annotated[Session, Depends(get_db)],
):
    return APIResponse(message="OK", data=OtAllotmentService(db).reject(ctx, row_id))


@compoff_requests_router.get("", response_model=APIResponse[list[CompoffRequestResponse]])
def list_compoff_requests(
    ctx: Annotated[TenantContext, Depends(require_permission("hr.leave:read"))],
    db: Annotated[Session, Depends(get_db)],
    pagination: Annotated[PaginationParams, Depends(get_pagination)],
    company_id: UUID | None = None,
):
    return APIResponse(
        message="OK",
        data=paginate(CompoffRequestService(db).list(ctx, company_id), pagination),
    )


@compoff_requests_router.post("", response_model=APIResponse[CompoffRequestResponse])
def create_compoff_request(
    body: CompoffRequestCreate,
    ctx: Annotated[TenantContext, Depends(require_permission("hr.leave:create"))],
    db: Annotated[Session, Depends(get_db)],
):
    payload = body.model_dump()
    status = payload.pop("status", None) or "draft"
    return APIResponse(
        message="OK",
        data=CompoffRequestService(db).create(ctx, status=status, **payload),
    )


@compoff_requests_router.post("/{row_id}/submit", response_model=APIResponse[CompoffRequestResponse])
def submit_compoff_request(
    row_id: UUID,
    ctx: Annotated[TenantContext, Depends(require_permission("hr.leave:update"))],
    db: Annotated[Session, Depends(get_db)],
):
    return APIResponse(message="OK", data=CompoffRequestService(db).submit(ctx, row_id))


@compoff_requests_router.post(
    "/{row_id}/manager-approve",
    response_model=APIResponse[CompoffRequestResponse],
)
def manager_approve_compoff_request(
    row_id: UUID,
    ctx: Annotated[TenantContext, Depends(require_permission("hr.leave:update"))],
    db: Annotated[Session, Depends(get_db)],
):
    return APIResponse(
        message="OK",
        data=CompoffRequestService(db).manager_approve(ctx, row_id),
    )


@compoff_requests_router.post("/{row_id}/approve", response_model=APIResponse[CompoffRequestResponse])
def approve_compoff_request(
    row_id: UUID,
    ctx: Annotated[TenantContext, Depends(require_permission("hr.leave:update"))],
    db: Annotated[Session, Depends(get_db)],
):
    return APIResponse(message="OK", data=CompoffRequestService(db).approve(ctx, row_id))


@compoff_requests_router.post("/{row_id}/reject", response_model=APIResponse[CompoffRequestResponse])
def reject_compoff_request(
    row_id: UUID,
    ctx: Annotated[TenantContext, Depends(require_permission("hr.leave:update"))],
    db: Annotated[Session, Depends(get_db)],
):
    return APIResponse(message="OK", data=CompoffRequestService(db).reject(ctx, row_id))


@biometric_devices_router.get("", response_model=APIResponse[list[BiometricDeviceResponse]])
def list_biometric_devices(
    ctx: Annotated[TenantContext, Depends(require_permission("hr.attendance:read"))],
    db: Annotated[Session, Depends(get_db)],
    pagination: Annotated[PaginationParams, Depends(get_pagination)],
    company_id: UUID | None = None,
):
    return APIResponse(
        message="OK",
        data=paginate(BiometricDeviceService(db).list(ctx, company_id), pagination),
    )


@biometric_devices_router.post("", response_model=APIResponse[BiometricDeviceResponse])
def create_biometric_device(
    body: BiometricDeviceCreate,
    ctx: Annotated[TenantContext, Depends(require_permission("hr.attendance:create"))],
    db: Annotated[Session, Depends(get_db)],
):
    payload = body.model_dump()
    generate = payload.pop("generate_api_key", True)
    row, api_key = BiometricDeviceService(db).create(ctx, generate_api_key=generate, **payload)
    data = BiometricDeviceResponse.model_validate(row).model_copy(update={"api_key": api_key})
    return APIResponse(message="OK", data=data)


@biometric_devices_router.post("/{row_id}/rotate-api-key", response_model=APIResponse[dict])
def rotate_biometric_api_key(
    row_id: UUID,
    ctx: Annotated[TenantContext, Depends(require_permission("hr.attendance:update"))],
    db: Annotated[Session, Depends(get_db)],
):
    key = BiometricDeviceService(db).rotate_api_key(ctx, row_id)
    return APIResponse(message="API key rotated", data={"api_key": key})


@biometric_devices_router.get("/{row_id}/live-feed", response_model=APIResponse[BiometricDeviceFeedResponse])
def biometric_device_live_feed(
    row_id: UUID,
    ctx: Annotated[TenantContext, Depends(require_permission("hr.attendance:read"))],
    db: Annotated[Session, Depends(get_db)],
    days: int = 14,
):
    return APIResponse(
        message="OK",
        data=BiometricDeviceService(db).live_feed(ctx, row_id, days=days),
    )


@attendance_router.post("/device-sync", response_model=APIResponse[DeviceSyncResponse])
def attendance_device_sync(
    body: DeviceSyncRequest,
    ctx: Annotated[TenantContext, Depends(require_permission("hr.attendance:create"))],
    db: Annotated[Session, Depends(get_db)],
    x_device_api_key: Annotated[str | None, Header(alias="X-Device-Api-Key")] = None,
):
    result = BiometricDeviceService(db).device_sync(
        ctx,
        punches=[p.model_dump() for p in body.punches],
        device_code=body.device_code,
        company_id=body.company_id,
        api_key=x_device_api_key or body.api_key,
    )
    return APIResponse(message="Device sync complete", data=result)


@shift_rotations_router.get("", response_model=APIResponse[list[ShiftRotationResponse]])
def list_shift_rotations(
    ctx: Annotated[TenantContext, Depends(require_permission("hr.shift:read"))],
    db: Annotated[Session, Depends(get_db)],
    pagination: Annotated[PaginationParams, Depends(get_pagination)],
    company_id: UUID | None = None,
):
    return APIResponse(
        message="OK",
        data=paginate(ShiftRotationService(db).list(ctx, company_id), pagination),
    )


@shift_rotations_router.post("", response_model=APIResponse[ShiftRotationResponse])
def create_shift_rotation(
    body: ShiftRotationCreate,
    ctx: Annotated[TenantContext, Depends(require_permission("hr.shift:create"))],
    db: Annotated[Session, Depends(get_db)],
):
    payload = body.model_dump()
    sequence = payload.pop("sequence")
    employee_ids = payload.pop("employee_ids")
    return APIResponse(
        message="OK",
        data=ShiftRotationService(db).create(
            ctx, sequence=sequence, employee_ids=employee_ids, **payload
        ),
    )


@shift_swaps_router.get("", response_model=APIResponse[list[ShiftSwapResponse]])
def list_shift_swaps(
    ctx: Annotated[TenantContext, Depends(require_permission("hr.shift:read"))],
    db: Annotated[Session, Depends(get_db)],
    pagination: Annotated[PaginationParams, Depends(get_pagination)],
    company_id: UUID | None = None,
):
    return APIResponse(
        message="OK",
        data=paginate(ShiftSwapService(db).list(ctx, company_id), pagination),
    )


@shift_swaps_router.post("", response_model=APIResponse[ShiftSwapResponse])
def create_shift_swap(
    body: ShiftSwapCreate,
    ctx: Annotated[TenantContext, Depends(require_permission("hr.shift:create"))],
    db: Annotated[Session, Depends(get_db)],
):
    payload = body.model_dump()
    status = payload.pop("status", None) or "draft"
    return APIResponse(
        message="OK",
        data=ShiftSwapService(db).create(ctx, status=status, **payload),
    )


@shift_swaps_router.post("/{row_id}/submit", response_model=APIResponse[ShiftSwapResponse])
def submit_shift_swap(
    row_id: UUID,
    ctx: Annotated[TenantContext, Depends(require_permission("hr.shift:update"))],
    db: Annotated[Session, Depends(get_db)],
):
    return APIResponse(message="OK", data=ShiftSwapService(db).submit(ctx, row_id))


@shift_swaps_router.post("/{row_id}/manager-approve", response_model=APIResponse[ShiftSwapResponse])
def manager_approve_shift_swap(
    row_id: UUID,
    ctx: Annotated[TenantContext, Depends(require_permission("hr.shift:update"))],
    db: Annotated[Session, Depends(get_db)],
):
    return APIResponse(message="OK", data=ShiftSwapService(db).manager_approve(ctx, row_id))


@shift_swaps_router.post("/{row_id}/approve", response_model=APIResponse[ShiftSwapResponse])
def approve_shift_swap(
    row_id: UUID,
    ctx: Annotated[TenantContext, Depends(require_permission("hr.shift:update"))],
    db: Annotated[Session, Depends(get_db)],
):
    return APIResponse(message="OK", data=ShiftSwapService(db).approve(ctx, row_id))


@shift_swaps_router.post("/{row_id}/reject", response_model=APIResponse[ShiftSwapResponse])
def reject_shift_swap(
    row_id: UUID,
    ctx: Annotated[TenantContext, Depends(require_permission("hr.shift:update"))],
    db: Annotated[Session, Depends(get_db)],
):
    return APIResponse(message="OK", data=ShiftSwapService(db).reject(ctx, row_id))


@employee_documents_router.get("", response_model=APIResponse[list[EmployeeDocumentResponse]])
def list_docs(
    ctx: Annotated[TenantContext, Depends(require_permission("hr.document:read"))],
    db: Annotated[Session, Depends(get_db)],
    pagination: Annotated[PaginationParams, Depends(get_pagination)],
    company_id: UUID | None = None,
):
    return APIResponse(message="OK", data=paginate(EmployeeDocumentService(db).list(ctx, company_id), pagination))


@employee_documents_router.post("", response_model=APIResponse[EmployeeDocumentResponse])
def create_doc(
    body: EmployeeDocumentCreate,
    ctx: Annotated[TenantContext, Depends(require_permission("hr.document:create"))],
    db: Annotated[Session, Depends(get_db)],
):
    return APIResponse(message="OK", data=EmployeeDocumentService(db).create(ctx, **body.model_dump()))


@employee_documents_router.post("/{row_id}/verify", response_model=APIResponse[EmployeeDocumentResponse])
def verify_doc(
    row_id: UUID,
    ctx: Annotated[TenantContext, Depends(require_permission("hr.document:verify"))],
    db: Annotated[Session, Depends(get_db)],
):
    return APIResponse(message="OK", data=EmployeeDocumentService(db).verify(ctx, row_id))


@performance_reviews_router.get("", response_model=APIResponse[list[PerformanceReviewResponse]])
def list_reviews(
    ctx: Annotated[TenantContext, Depends(require_permission("hr.performance:read"))],
    db: Annotated[Session, Depends(get_db)],
    pagination: Annotated[PaginationParams, Depends(get_pagination)],
    company_id: UUID | None = None,
):
    return APIResponse(message="OK", data=paginate(PerformanceService(db).list(ctx, company_id), pagination))


@performance_reviews_router.post("", response_model=APIResponse[PerformanceReviewResponse])
def create_review(
    body: PerformanceReviewCreate,
    ctx: Annotated[TenantContext, Depends(require_permission("hr.performance:create"))],
    db: Annotated[Session, Depends(get_db)],
):
    return APIResponse(message="OK", data=PerformanceService(db).create(ctx, **body.model_dump()))


@performance_reviews_router.post("/{row_id}/submit", response_model=APIResponse[PerformanceReviewResponse])
def submit_review(
    row_id: UUID,
    ctx: Annotated[TenantContext, Depends(require_permission("hr.performance:submit"))],
    db: Annotated[Session, Depends(get_db)],
):
    return APIResponse(message="OK", data=PerformanceService(db).submit(ctx, row_id))


@performance_reviews_router.post("/{row_id}/approve", response_model=APIResponse[PerformanceReviewResponse])
def approve_review(
    row_id: UUID,
    ctx: Annotated[TenantContext, Depends(require_permission("hr.performance:approve"))],
    db: Annotated[Session, Depends(get_db)],
):
    return APIResponse(message="OK", data=PerformanceService(db).approve(ctx, row_id))


@goals_router.get("", response_model=APIResponse[list[GoalResponse]])
def list_goals(
    ctx: Annotated[TenantContext, Depends(require_permission("hr.performance:read"))],
    db: Annotated[Session, Depends(get_db)],
    pagination: Annotated[PaginationParams, Depends(get_pagination)],
    company_id: UUID | None = None,
):
    return APIResponse(message="OK", data=paginate(GoalService(db).list(ctx, company_id), pagination))


@goals_router.post("", response_model=APIResponse[GoalResponse])
def create_goal(
    body: GoalCreate,
    ctx: Annotated[TenantContext, Depends(require_permission("hr.performance:create"))],
    db: Annotated[Session, Depends(get_db)],
):
    return APIResponse(message="OK", data=GoalService(db).create(ctx, **body.model_dump()))


def _okr_response(row) -> OkrResponse:
    krs = [
        {
            "id": kr.id,
            "title": kr.title,
            "progress_pct": kr.progress_pct,
            "weightage": kr.weightage,
            "sequence_no": kr.sequence_no,
            "status": kr.status,
        }
        for kr in (row.key_results or [])
        if not getattr(kr, "is_deleted", False)
    ]
    return OkrResponse(
        id=row.id,
        company_id=row.company_id,
        branch_id=row.branch_id,
        title=row.title,
        owner=row.owner,
        department=row.department,
        weightage=row.weightage,
        progress_pct=row.progress_pct,
        status=row.status,
        version=row.version,
        key_results=krs,
        created_at=getattr(row, "created_at", None),
    )


@kpis_router.get("", response_model=APIResponse[list[KpiResponse]])
def list_kpis(
    ctx: Annotated[TenantContext, Depends(require_permission("hr.performance:read"))],
    db: Annotated[Session, Depends(get_db)],
    pagination: Annotated[PaginationParams, Depends(get_pagination)],
    company_id: UUID | None = None,
):
    return APIResponse(message="OK", data=paginate(KpiService(db).list(ctx, company_id), pagination))


@kpis_router.post("", response_model=APIResponse[KpiResponse])
def create_kpi(
    body: KpiCreate,
    ctx: Annotated[TenantContext, Depends(require_permission("hr.performance:create"))],
    db: Annotated[Session, Depends(get_db)],
):
    return APIResponse(message="OK", data=KpiService(db).create(ctx, **body.model_dump()))


@kpis_router.patch("/{row_id}", response_model=APIResponse[KpiResponse])
def update_kpi(
    row_id: UUID,
    body: KpiUpdate,
    ctx: Annotated[TenantContext, Depends(require_permission("hr.performance:create"))],
    db: Annotated[Session, Depends(get_db)],
):
    return APIResponse(
        message="OK",
        data=KpiService(db).update(ctx, row_id, **extract_update_fields(body)),
    )


@kpis_router.delete("/{row_id}", response_model=APIResponse[None])
def delete_kpi(
    row_id: UUID,
    ctx: Annotated[TenantContext, Depends(require_permission("hr.performance:create"))],
    db: Annotated[Session, Depends(get_db)],
):
    KpiService(db).delete(ctx, row_id)
    return APIResponse(message="Deleted", data=None)


@okrs_router.get("", response_model=APIResponse[list[OkrResponse]])
def list_okrs(
    ctx: Annotated[TenantContext, Depends(require_permission("hr.performance:read"))],
    db: Annotated[Session, Depends(get_db)],
    pagination: Annotated[PaginationParams, Depends(get_pagination)],
    company_id: UUID | None = None,
):
    rows = OkrService(db).list(ctx, company_id)
    return APIResponse(message="OK", data=paginate([_okr_response(r) for r in rows], pagination))


@okrs_router.post("", response_model=APIResponse[OkrResponse])
def create_okr(
    body: OkrCreate,
    ctx: Annotated[TenantContext, Depends(require_permission("hr.performance:create"))],
    db: Annotated[Session, Depends(get_db)],
):
    payload = body.model_dump()
    krs = payload.pop("key_results", []) or []
    row = OkrService(db).create(ctx, key_results=krs, **payload)
    return APIResponse(message="OK", data=_okr_response(row))


@okrs_router.patch("/{row_id}", response_model=APIResponse[OkrResponse])
def update_okr(
    row_id: UUID,
    body: OkrUpdate,
    ctx: Annotated[TenantContext, Depends(require_permission("hr.performance:create"))],
    db: Annotated[Session, Depends(get_db)],
):
    fields = extract_update_fields(body)
    if "key_results" in body.model_dump(exclude_unset=True):
        fields["key_results"] = [kr.model_dump() if hasattr(kr, "model_dump") else kr for kr in (body.key_results or [])]
    row = OkrService(db).update(ctx, row_id, **fields)
    return APIResponse(message="OK", data=_okr_response(row))


@okrs_router.delete("/{row_id}", response_model=APIResponse[None])
def delete_okr(
    row_id: UUID,
    ctx: Annotated[TenantContext, Depends(require_permission("hr.performance:create"))],
    db: Annotated[Session, Depends(get_db)],
):
    OkrService(db).delete(ctx, row_id)
    return APIResponse(message="Deleted", data=None)


@okrs_router.post("/{row_id}/key-results", response_model=APIResponse[OkrResponse])
def add_okr_key_result(
    row_id: UUID,
    body: OkrKeyResultIn,
    ctx: Annotated[TenantContext, Depends(require_permission("hr.performance:create"))],
    db: Annotated[Session, Depends(get_db)],
):
    row = OkrService(db).add_key_result(ctx, row_id, **body.model_dump())
    return APIResponse(message="OK", data=_okr_response(row))


@okrs_router.patch("/{row_id}/key-results/{kr_id}", response_model=APIResponse[OkrResponse])
def update_okr_key_result(
    row_id: UUID,
    kr_id: UUID,
    body: OkrKeyResultIn,
    ctx: Annotated[TenantContext, Depends(require_permission("hr.performance:create"))],
    db: Annotated[Session, Depends(get_db)],
):
    row = OkrService(db).update_key_result(ctx, row_id, kr_id, **body.model_dump())
    return APIResponse(message="OK", data=_okr_response(row))


@okrs_router.delete("/{row_id}/key-results/{kr_id}", response_model=APIResponse[OkrResponse])
def delete_okr_key_result(
    row_id: UUID,
    kr_id: UUID,
    ctx: Annotated[TenantContext, Depends(require_permission("hr.performance:create"))],
    db: Annotated[Session, Depends(get_db)],
):
    row = OkrService(db).delete_key_result(ctx, row_id, kr_id)
    return APIResponse(message="OK", data=_okr_response(row))


@appraisals_router.get("", response_model=APIResponse[list[AppraisalResponse]])
def list_appraisals(
    ctx: Annotated[TenantContext, Depends(require_permission("hr.performance:read"))],
    db: Annotated[Session, Depends(get_db)],
    pagination: Annotated[PaginationParams, Depends(get_pagination)],
    company_id: UUID | None = None,
):
    return APIResponse(message="OK", data=paginate(AppraisalService(db).list(ctx, company_id), pagination))


@appraisals_router.post("", response_model=APIResponse[AppraisalResponse])
def create_appraisal(
    body: AppraisalCreate,
    ctx: Annotated[TenantContext, Depends(require_permission("hr.performance:create"))],
    db: Annotated[Session, Depends(get_db)],
):
    return APIResponse(message="OK", data=AppraisalService(db).create(ctx, **body.model_dump()))


@training_router.get("", response_model=APIResponse[list[TrainingResponse]])
def list_training(
    ctx: Annotated[TenantContext, Depends(require_permission("hr.training:read"))],
    db: Annotated[Session, Depends(get_db)],
    pagination: Annotated[PaginationParams, Depends(get_pagination)],
    company_id: UUID | None = None,
):
    return APIResponse(message="OK", data=paginate(TrainingService(db).list(ctx, company_id), pagination))


@training_router.post("", response_model=APIResponse[TrainingResponse])
def create_training(
    body: TrainingCreate,
    ctx: Annotated[TenantContext, Depends(require_permission("hr.training:create"))],
    db: Annotated[Session, Depends(get_db)],
):
    return APIResponse(message="OK", data=TrainingService(db).create(ctx, **body.model_dump(exclude_none=True)))


@training_router.patch("/{row_id}", response_model=APIResponse[TrainingResponse])
def update_training(
    row_id: UUID,
    body: TrainingUpdate,
    ctx: Annotated[TenantContext, Depends(require_permission("hr.training:update"))],
    db: Annotated[Session, Depends(get_db)],
):
    return APIResponse(message="OK", data=TrainingService(db).update(ctx, row_id, **extract_update_fields(body)))


@training_router.post("/{row_id}/assign", response_model=APIResponse[TrainingAttendanceResponse])
def assign_training(
    row_id: UUID,
    body: TrainingAssignRequest,
    ctx: Annotated[TenantContext, Depends(require_permission("hr.training:assign"))],
    db: Annotated[Session, Depends(get_db)],
):
    return APIResponse(message="OK", data=TrainingService(db).assign(ctx, row_id, **body.model_dump()))


@training_attendance_router.get("", response_model=APIResponse[list[TrainingAttendanceResponse]])
def list_training_attendance(
    ctx: Annotated[TenantContext, Depends(require_permission("hr.training:read"))],
    db: Annotated[Session, Depends(get_db)],
    pagination: Annotated[PaginationParams, Depends(get_pagination)],
    company_id: UUID | None = None,
):
    return APIResponse(message="OK", data=paginate(TrainingAttendanceService(db).list(ctx, company_id), pagination))


@training_rooms_router.get("", response_model=APIResponse[list[TrainingRoomResponse]])
def list_training_rooms(
    ctx: Annotated[TenantContext, Depends(require_permission("hr.training:read"))],
    db: Annotated[Session, Depends(get_db)],
    pagination: Annotated[PaginationParams, Depends(get_pagination)],
    company_id: UUID | None = None,
):
    return APIResponse(message="OK", data=paginate(TrainingRoomService(db).list(ctx, company_id), pagination))


@training_rooms_router.post("", response_model=APIResponse[TrainingRoomResponse])
def create_training_room(
    body: TrainingRoomCreate,
    ctx: Annotated[TenantContext, Depends(require_permission("hr.training:create"))],
    db: Annotated[Session, Depends(get_db)],
):
    return APIResponse(message="OK", data=TrainingRoomService(db).create(ctx, **body.model_dump(exclude_none=True)))


@training_rooms_router.patch("/{row_id}", response_model=APIResponse[TrainingRoomResponse])
def update_training_room(
    row_id: UUID,
    body: TrainingRoomUpdate,
    ctx: Annotated[TenantContext, Depends(require_permission("hr.training:update"))],
    db: Annotated[Session, Depends(get_db)],
):
    return APIResponse(
        message="OK",
        data=TrainingRoomService(db).update(ctx, row_id, **extract_update_fields(body)),
    )


@training_requests_router.get("", response_model=APIResponse[list[TrainingRequestResponse]])
def list_training_requests(
    ctx: Annotated[TenantContext, Depends(require_permission("hr.training:read"))],
    db: Annotated[Session, Depends(get_db)],
    pagination: Annotated[PaginationParams, Depends(get_pagination)],
    company_id: UUID | None = None,
):
    return APIResponse(message="OK", data=paginate(TrainingRequestService(db).list(ctx, company_id), pagination))


@training_requests_router.post("", response_model=APIResponse[TrainingRequestResponse])
def create_training_request(
    body: TrainingRequestCreate,
    ctx: Annotated[TenantContext, Depends(require_permission("hr.training:create"))],
    db: Annotated[Session, Depends(get_db)],
):
    payload = body.model_dump(exclude_none=True)
    attendees = payload.pop("attendees", []) or []
    payload["attendees_json"] = [
        {
            "employee_id": str(a["employee_id"]),
            "employee_name": a.get("employee_name"),
            "employee_code": a.get("employee_code"),
        }
        for a in attendees
    ]
    return APIResponse(message="OK", data=TrainingRequestService(db).create(ctx, **payload))


@training_requests_router.post("/{row_id}/approve", response_model=APIResponse[TrainingRequestResponse])
def approve_training_request(
    row_id: UUID,
    body: TrainingRequestDecision,
    ctx: Annotated[TenantContext, Depends(require_permission("hr.training:update"))],
    db: Annotated[Session, Depends(get_db)],
):
    return APIResponse(
        message="OK",
        data=TrainingRequestService(db).approve(ctx, row_id, approval_notes=body.approval_notes),
    )


@training_requests_router.post("/{row_id}/reject", response_model=APIResponse[TrainingRequestResponse])
def reject_training_request(
    row_id: UUID,
    body: TrainingRequestDecision,
    ctx: Annotated[TenantContext, Depends(require_permission("hr.training:update"))],
    db: Annotated[Session, Depends(get_db)],
):
    return APIResponse(
        message="OK",
        data=TrainingRequestService(db).reject(ctx, row_id, approval_notes=body.approval_notes),
    )


@separation_router.get("", response_model=APIResponse[list[SeparationResponse]])
def list_separation(
    ctx: Annotated[TenantContext, Depends(require_permission("hr.separation:read"))],
    db: Annotated[Session, Depends(get_db)],
    pagination: Annotated[PaginationParams, Depends(get_pagination)],
    company_id: UUID | None = None,
):
    return APIResponse(message="OK", data=paginate(SeparationService(db).list(ctx, company_id), pagination))


@separation_router.post("", response_model=APIResponse[SeparationResponse])
def create_separation(
    body: SeparationCreate,
    ctx: Annotated[TenantContext, Depends(require_permission("hr.separation:create"))],
    db: Annotated[Session, Depends(get_db)],
):
    return APIResponse(message="OK", data=SeparationService(db).create(ctx, **body.model_dump()))


@separation_router.post("/{row_id}/submit", response_model=APIResponse[SeparationResponse])
def submit_separation(
    row_id: UUID,
    ctx: Annotated[TenantContext, Depends(require_permission("hr.separation:submit"))],
    db: Annotated[Session, Depends(get_db)],
):
    return APIResponse(message="OK", data=SeparationService(db).submit(ctx, row_id))


@separation_router.post("/{row_id}/approve", response_model=APIResponse[SeparationResponse])
def approve_separation(
    row_id: UUID,
    body: SeparationApproveRequest,
    ctx: Annotated[TenantContext, Depends(require_permission("hr.separation:approve"))],
    db: Annotated[Session, Depends(get_db)],
):
    return APIResponse(message="OK", data=SeparationService(db).approve(ctx, row_id, **body.model_dump()))


@separation_router.post("/{row_id}/complete", response_model=APIResponse[SeparationResponse])
def complete_separation(
    row_id: UUID,
    body: SeparationCompleteRequest,
    ctx: Annotated[TenantContext, Depends(require_permission("hr.separation:complete"))],
    db: Annotated[Session, Depends(get_db)],
):
    return APIResponse(message="OK", data=SeparationService(db).complete(ctx, row_id, **body.model_dump()))


@separation_router.post("/{row_id}/fnf/prepare", response_model=APIResponse[SeparationResponse])
def prepare_separation_fnf(
    row_id: UUID,
    ctx: Annotated[TenantContext, Depends(require_permission("hr.separation:approve"))],
    db: Annotated[Session, Depends(get_db)],
):
    return APIResponse(message="FNF prepared", data=SeparationService(db).prepare_fnf(ctx, row_id))


@separation_router.post("/{row_id}/fnf/settle", response_model=APIResponse[SeparationResponse])
def settle_separation_fnf(
    row_id: UUID,
    ctx: Annotated[TenantContext, Depends(require_permission("hr.separation:complete"))],
    db: Annotated[Session, Depends(get_db)],
):
    return APIResponse(message="FNF settled", data=SeparationService(db).settle_fnf(ctx, row_id))


@separation_router.post("/{row_id}/checklist", response_model=APIResponse[SeparationResponse])
def update_separation_checklist(
    row_id: UUID,
    body: SeparationChecklistUpdate,
    ctx: Annotated[TenantContext, Depends(require_permission("hr.separation:approve"))],
    db: Annotated[Session, Depends(get_db)],
):
    return APIResponse(
        message="Checklist updated",
        data=SeparationService(db).update_checklist(ctx, row_id, **body.model_dump()),
    )


@separation_router.post("/{row_id}/exit-interview", response_model=APIResponse[SeparationResponse])
def save_separation_exit_interview(
    row_id: UUID,
    body: SeparationExitInterviewRequest,
    ctx: Annotated[TenantContext, Depends(require_permission("hr.separation:approve"))],
    db: Annotated[Session, Depends(get_db)],
):
    return APIResponse(
        message="Exit interview saved",
        data=SeparationService(db).save_exit_interview(ctx, row_id, **body.model_dump()),
    )


@reports_router.get("/summary", response_model=APIResponse[ReportSummaryResponse])
def report_summary(
    ctx: Annotated[TenantContext, Depends(require_permission("hr.report:read"))],
    db: Annotated[Session, Depends(get_db)],
    company_id: UUID | None = None,
):
    return APIResponse(message="OK", data=HRReportService(db).summary(ctx, company_id))


@reports_router.get("/export")
def report_export(
    ctx: Annotated[TenantContext, Depends(require_permission("hr.report:export"))],
    db: Annotated[Session, Depends(get_db)],
    report_type: str = "attendance",
    fmt: str = "csv",
    company_id: UUID | None = None,
):
    from fastapi.responses import Response

    from core.exceptions import AppException

    if fmt not in {"csv", "pdf"}:
        raise AppException("fmt must be csv or pdf")
    try:
        payload, filename, media = HRReportService(db).export(
            ctx, report_type=report_type, fmt=fmt, company_id=company_id
        )
    except ValueError as exc:
        raise AppException(str(exc)) from exc
    return Response(
        content=payload,
        media_type=media,
        headers={"Content-Disposition": f'attachment; filename="{filename}"'},
    )


@ess_inbox_router.get("", response_model=APIResponse[list[HrEssInboxItemResponse]])
def list_hr_ess_inbox(
    ctx: Annotated[TenantContext, Depends(require_permission("hr.leave:read"))],
    db: Annotated[Session, Depends(get_db)],
    company_id: UUID | None = None,
):
    from modules.hr.service.ess_inbox_service import HrEssInboxService

    return APIResponse(message="OK", data=HrEssInboxService(db).list_inbox(ctx, company_id=company_id))


# --- Job Levels & Grades (Phase 3 masters) ---
job_levels_router = APIRouter(prefix="/job-levels", tags=["HR - Job Levels"])
grades_router = APIRouter(prefix="/grades", tags=["HR - Grades"])


@job_levels_router.get("", response_model=APIResponse[list[JobLevelResponse]])
def list_job_levels(
    ctx: Annotated[TenantContext, Depends(require_permission("hr.job_level:read"))],
    db: Annotated[Session, Depends(get_db)],
    pagination: Annotated[PaginationParams, Depends(get_pagination)],
    company_id: UUID | None = None,
):
    from modules.hr.service.job_architecture_service import JobLevelService

    return APIResponse(message="OK", data=paginate(JobLevelService(db).list(ctx, company_id), pagination))


@job_levels_router.post("", response_model=APIResponse[JobLevelResponse])
def create_job_level(
    body: JobLevelCreate,
    ctx: Annotated[TenantContext, Depends(require_permission("hr.job_level:create"))],
    db: Annotated[Session, Depends(get_db)],
):
    from modules.hr.service.job_architecture_service import JobLevelService

    return APIResponse(message="OK", data=JobLevelService(db).create(ctx, **body.model_dump()))


@job_levels_router.patch("/{row_id}", response_model=APIResponse[JobLevelResponse])
def update_job_level(
    row_id: UUID,
    body: JobLevelUpdate,
    ctx: Annotated[TenantContext, Depends(require_permission("hr.job_level:update"))],
    db: Annotated[Session, Depends(get_db)],
):
    from modules.hr.service.job_architecture_service import JobLevelService

    return APIResponse(message="OK", data=JobLevelService(db).update(ctx, row_id, **extract_update_fields(body)))


@grades_router.get("", response_model=APIResponse[list[GradeResponse]])
def list_grades(
    ctx: Annotated[TenantContext, Depends(require_permission("hr.grade:read"))],
    db: Annotated[Session, Depends(get_db)],
    pagination: Annotated[PaginationParams, Depends(get_pagination)],
    company_id: UUID | None = None,
):
    from modules.hr.service.job_architecture_service import GradeService

    return APIResponse(message="OK", data=paginate(GradeService(db).list(ctx, company_id), pagination))


@grades_router.post("", response_model=APIResponse[GradeResponse])
def create_grade(
    body: GradeCreate,
    ctx: Annotated[TenantContext, Depends(require_permission("hr.grade:create"))],
    db: Annotated[Session, Depends(get_db)],
):
    from modules.hr.service.job_architecture_service import GradeService

    return APIResponse(message="OK", data=GradeService(db).create(ctx, **body.model_dump()))


@grades_router.patch("/{row_id}", response_model=APIResponse[GradeResponse])
def update_grade(
    row_id: UUID,
    body: GradeUpdate,
    ctx: Annotated[TenantContext, Depends(require_permission("hr.grade:update"))],
    db: Annotated[Session, Depends(get_db)],
):
    from modules.hr.service.job_architecture_service import GradeService

    return APIResponse(message="OK", data=GradeService(db).update(ctx, row_id, **extract_update_fields(body)))
