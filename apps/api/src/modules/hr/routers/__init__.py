"""HR REST routers."""

from typing import Annotated
from uuid import UUID

from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session

from modules.foundation.dependencies import require_permission
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
    AttendanceCreate,
    AttendanceResponse,
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
    HolidayCalendarCreate,
    HolidayCalendarResponse,
    HolidayCalendarUpdate,
    LeaveApproveRequest,
    LeaveBalanceCreate,
    LeaveBalanceResponse,
    LeaveRequestCreate,
    LeaveRequestResponse,
    LeaveTypeCreate,
    LeaveTypeResponse,
    LeaveTypeUpdate,
    PerformanceReviewCreate,
    PerformanceReviewResponse,
    ReportSummaryResponse,
    SeparationApproveRequest,
    SeparationCompleteRequest,
    SeparationCreate,
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
)
from modules.hr.service import (
    AppraisalService,
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
    LeaveBalanceService,
    LeaveRequestService,
    LeaveTypeService,
    PerformanceService,
    SeparationService,
    ShiftAssignmentService,
    ShiftService,
    TrainingAttendanceService,
    TrainingRequestService,
    TrainingRoomService,
    TrainingService,
)
from shared.schemas import APIResponse

designations_router = APIRouter(prefix="/designations", tags=["HR - Designations"])
employee_profiles_router = APIRouter(prefix="/employee-profiles", tags=["HR - Employee Profiles"])
employment_router = APIRouter(prefix="/employment", tags=["HR - Employment"])
department_assignments_router = APIRouter(prefix="/department-assignments", tags=["HR - Department Assignments"])
designation_assignments_router = APIRouter(prefix="/designation-assignments", tags=["HR - Designation Assignments"])
shifts_router = APIRouter(prefix="/shifts", tags=["HR - Shifts"])
shift_assignments_router = APIRouter(prefix="/shift-assignments", tags=["HR - Shift Assignments"])
holiday_calendars_router = APIRouter(prefix="/holiday-calendars", tags=["HR - Holiday Calendars"])
leave_types_router = APIRouter(prefix="/leave-types", tags=["HR - Leave Types"])
leave_balances_router = APIRouter(prefix="/leave-balances", tags=["HR - Leave Balances"])
leave_requests_router = APIRouter(prefix="/leave-requests", tags=["HR - Leave Requests"])
attendance_router = APIRouter(prefix="/attendance", tags=["HR - Attendance"])
employee_documents_router = APIRouter(prefix="/employee-documents", tags=["HR - Employee Documents"])
performance_reviews_router = APIRouter(prefix="/performance-reviews", tags=["HR - Performance Reviews"])
goals_router = APIRouter(prefix="/goals", tags=["HR - Goals"])
appraisals_router = APIRouter(prefix="/appraisals", tags=["HR - Appraisals"])
training_router = APIRouter(prefix="/training", tags=["HR - Training"])
training_attendance_router = APIRouter(prefix="/training-attendance", tags=["HR - Training Attendance"])
training_rooms_router = APIRouter(prefix="/training-rooms", tags=["HR - Training Rooms"])
training_requests_router = APIRouter(prefix="/training-requests", tags=["HR - Training Requests"])
separation_router = APIRouter(prefix="/separation", tags=["HR - Separation"])
reports_router = APIRouter(prefix="/reports", tags=["HR - Reports"])


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
    ctx: Annotated[TenantContext, Depends(require_permission("hr.leave:create"))],
    db: Annotated[Session, Depends(get_db)],
):
    return APIResponse(message="OK", data=LeaveBalanceService(db).create(ctx, **body.model_dump()))


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


@reports_router.get("/summary", response_model=APIResponse[ReportSummaryResponse])
def report_summary(
    ctx: Annotated[TenantContext, Depends(require_permission("hr.report:read"))],
    db: Annotated[Session, Depends(get_db)],
    company_id: UUID | None = None,
):
    return APIResponse(message="OK", data=HRReportService(db).summary(ctx, company_id))
