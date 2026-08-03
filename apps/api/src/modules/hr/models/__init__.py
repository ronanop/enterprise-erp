"""HR ORM models."""

from modules.hr.models.appraisal import HrAppraisal
from modules.hr.models.attendance import HrAttendance
from modules.hr.models.attendance_correction import HrAttendanceCorrection
from modules.hr.models.attendance_rule import HrAttendanceRule
from modules.hr.models.department_assignment import HrDepartmentAssignment
from modules.hr.models.designation import HrDesignation
from modules.hr.models.designation_assignment import HrDesignationAssignment
from modules.hr.models.employee_document import HrEmployeeDocument
from modules.hr.models.employee_profile import HrEmployeeProfile
from modules.hr.models.employment import HrEmployment
from modules.hr.models.goal import HrGoal
from modules.hr.models.grade import HrGrade
from modules.hr.models.holiday_calendar import HrHolidayCalendar
from modules.hr.models.job_level import HrJobLevel
from modules.hr.models.leave_adjustment import HrLeaveAdjustment
from modules.hr.models.leave_balance import HrLeaveBalance
from modules.hr.models.leave_request import HrLeaveRequest
from modules.hr.models.leave_type import HrLeaveType
from modules.hr.models.management_group import HrManagementGroup
from modules.hr.models.performance_review import HrPerformanceReview
from modules.hr.models.roster_entry import HrRosterEntry
from modules.hr.models.separation import HrSeparation
from modules.hr.models.shift import HrShift
from modules.hr.models.shift_assignment import HrShiftAssignment
from modules.hr.models.training import HrTraining
from modules.hr.models.training_attendance import HrTrainingAttendance
from modules.hr.models.training_request import HrTrainingRequest
from modules.hr.models.training_room import HrTrainingRoom
from modules.hr.models.weekly_off_policy import HrWeeklyOffPolicy
from modules.hr.models.on_duty_request import HrOnDutyRequest
from modules.hr.models.ot_allotment import HrOtAllotment
from modules.hr.models.kpi import HrKpi
from modules.hr.models.okr import HrOkr, HrOkrKeyResult
from modules.hr.models.biometric_device import HrBiometricDevice
from modules.hr.models.compoff_request import HrCompoffRequest
from modules.hr.models.shift_rotation import HrShiftRotation
from modules.hr.models.shift_swap import HrShiftSwapRequest

__all__ = [
    "HrDesignation",
    "HrEmployeeProfile",
    "HrEmployment",
    "HrManagementGroup",
    "HrDepartmentAssignment",
    "HrDesignationAssignment",
    "HrShift",
    "HrShiftAssignment",
    "HrHolidayCalendar",
    "HrLeaveType",
    "HrLeaveBalance",
    "HrLeaveRequest",
    "HrLeaveAdjustment",
    "HrAttendance",
    "HrAttendanceCorrection",
    "HrAttendanceRule",
    "HrWeeklyOffPolicy",
    "HrOnDutyRequest",
    "HrOtAllotment",
    "HrKpi",
    "HrOkr",
    "HrOkrKeyResult",
    "HrBiometricDevice",
    "HrCompoffRequest",
    "HrShiftRotation",
    "HrShiftSwapRequest",
    "HrEmployeeDocument",
    "HrPerformanceReview",
    "HrGoal",
    "HrAppraisal",
    "HrTraining",
    "HrTrainingAttendance",
    "HrTrainingRoom",
    "HrTrainingRequest",
    "HrSeparation",
    "HrLifecycleEvent",
    "HrJobLevel",
    "HrGrade",
    "HrRosterEntry",
]
