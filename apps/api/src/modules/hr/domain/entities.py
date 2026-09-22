"""HR domain entity markers (aggregates map 1:1 to ORM headers)."""

from enum import Enum


class HrAggregate(str, Enum):
    DESIGNATION = "hr_designation"
    EMPLOYEE_PROFILE = "hr_employee_profile"
    EMPLOYMENT = "hr_employment"
    DEPARTMENT_ASSIGNMENT = "hr_department_assignment"
    DESIGNATION_ASSIGNMENT = "hr_designation_assignment"
    SHIFT = "hr_shift"
    SHIFT_ASSIGNMENT = "hr_shift_assignment"
    HOLIDAY_CALENDAR = "hr_holiday_calendar"
    LEAVE_TYPE = "hr_leave_type"
    LEAVE_BALANCE = "hr_leave_balance"
    LEAVE_REQUEST = "hr_leave_request"
    ATTENDANCE = "hr_attendance"
    EMPLOYEE_DOCUMENT = "hr_employee_document"
    PERFORMANCE_REVIEW = "hr_performance_review"
    GOAL = "hr_goal"
    APPRAISAL = "hr_appraisal"
    TRAINING = "hr_training"
    TRAINING_ATTENDANCE = "hr_training_attendance"
    TRAINING_ROOM = "hr_training_room"
    TRAINING_REQUEST = "hr_training_request"
    SEPARATION = "hr_separation"
