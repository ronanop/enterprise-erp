"""HR services."""

from modules.hr.service.application_service import HRApplicationService
from modules.hr.service.assignment_service import (
    DepartmentAssignmentService,
    DesignationAssignmentService,
)
from modules.hr.service.attendance_service import AttendanceService
from modules.hr.service.attendance_correction_service import AttendanceCorrectionService
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
from modules.hr.service.training_service import (
    TrainingAttendanceService,
    TrainingRequestService,
    TrainingRoomService,
    TrainingService,
)

LeaveService = LeaveRequestService

__all__ = [
    "AppraisalService",
    "AttendanceService",
    "AttendanceCorrectionService",
    "DepartmentAssignmentService",
    "DesignationAssignmentService",
    "DesignationService",
    "EmployeeDocumentService",
    "EmployeeProfileService",
    "EmploymentService",
    "GoalService",
    "HolidayCalendarService",
    "HRApplicationService",
    "HRIntegrationService",
    "HRReportService",
    "LeaveAdjustmentService",
    "LeaveBalanceService",
    "LeaveRequestService",
    "LeaveService",
    "LeaveTypeService",
    "PerformanceService",
    "RosterEntryService",
    "SeparationService",
    "ShiftAssignmentService",
    "ShiftService",
    "TrainingAttendanceService",
    "TrainingRequestService",
    "TrainingRoomService",
    "TrainingService",
]
