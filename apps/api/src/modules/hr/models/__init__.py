"""HR ORM models."""

from modules.hr.models.appraisal import HrAppraisal
from modules.hr.models.attendance import HrAttendance
from modules.hr.models.department_assignment import HrDepartmentAssignment
from modules.hr.models.designation import HrDesignation
from modules.hr.models.designation_assignment import HrDesignationAssignment
from modules.hr.models.employee_document import HrEmployeeDocument
from modules.hr.models.employee_profile import HrEmployeeProfile
from modules.hr.models.employment import HrEmployment
from modules.hr.models.goal import HrGoal
from modules.hr.models.holiday_calendar import HrHolidayCalendar
from modules.hr.models.leave_balance import HrLeaveBalance
from modules.hr.models.leave_request import HrLeaveRequest
from modules.hr.models.leave_type import HrLeaveType
from modules.hr.models.performance_review import HrPerformanceReview
from modules.hr.models.separation import HrSeparation
from modules.hr.models.shift import HrShift
from modules.hr.models.shift_assignment import HrShiftAssignment
from modules.hr.models.training import HrTraining
from modules.hr.models.training_attendance import HrTrainingAttendance
from modules.hr.models.training_request import HrTrainingRequest
from modules.hr.models.training_room import HrTrainingRoom

__all__ = [
    "HrDesignation",
    "HrEmployeeProfile",
    "HrEmployment",
    "HrDepartmentAssignment",
    "HrDesignationAssignment",
    "HrShift",
    "HrShiftAssignment",
    "HrHolidayCalendar",
    "HrLeaveType",
    "HrLeaveBalance",
    "HrLeaveRequest",
    "HrAttendance",
    "HrEmployeeDocument",
    "HrPerformanceReview",
    "HrGoal",
    "HrAppraisal",
    "HrTraining",
    "HrTrainingAttendance",
    "HrTrainingRoom",
    "HrTrainingRequest",
    "HrSeparation",
]
