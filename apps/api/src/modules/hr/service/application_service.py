"""HR application service facade."""

from sqlalchemy.orm import Session

from modules.hr.service.assignment_service import (
    DepartmentAssignmentService,
    DesignationAssignmentService,
)
from modules.hr.service.attendance_service import AttendanceService
from modules.hr.service.designation_service import DesignationService
from modules.hr.service.document_service import EmployeeDocumentService
from modules.hr.service.employee_profile_service import EmployeeProfileService
from modules.hr.service.employment_service import EmploymentService
from modules.hr.service.holiday_calendar_service import HolidayCalendarService
from modules.hr.service.integration_service import HRIntegrationService
from modules.hr.service.leave_service import (
    LeaveAdjustmentService,
    LeaveBalanceService,
    LeaveRequestService,
    LeaveTypeService,
)
from modules.hr.service.performance_service import AppraisalService, GoalService, PerformanceService
from modules.hr.service.report_service import HRReportService
from modules.hr.service.roster_service import RosterEntryService
from modules.hr.service.separation_service import SeparationService
from modules.hr.service.shift_service import ShiftAssignmentService, ShiftService
from modules.hr.service.training_service import TrainingAttendanceService, TrainingService


class HRApplicationService:
    def __init__(self, db: Session) -> None:
        self.designations = DesignationService(db)
        self.employee_profiles = EmployeeProfileService(db)
        self.employment = EmploymentService(db)
        self.department_assignments = DepartmentAssignmentService(db)
        self.designation_assignments = DesignationAssignmentService(db)
        self.shifts = ShiftService(db)
        self.shift_assignments = ShiftAssignmentService(db)
        self.roster_entries = RosterEntryService(db)
        self.holiday_calendars = HolidayCalendarService(db)
        self.leave_types = LeaveTypeService(db)
        self.leave_balances = LeaveBalanceService(db)
        self.leave_requests = LeaveRequestService(db)
        self.leave_adjustments = LeaveAdjustmentService(db)
        self.attendance = AttendanceService(db)
        self.documents = EmployeeDocumentService(db)
        self.performance = PerformanceService(db)
        self.goals = GoalService(db)
        self.appraisals = AppraisalService(db)
        self.training = TrainingService(db)
        self.training_attendance = TrainingAttendanceService(db)
        self.separation = SeparationService(db)
        self.reports = HRReportService(db)
        self.integration = HRIntegrationService(db)
