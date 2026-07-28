"""HR domain enums per ERD_11."""

from enum import Enum


class ActiveInactive(str, Enum):
    ACTIVE = "active"
    INACTIVE = "inactive"


class JobLevel(str, Enum):
    JUNIOR = "junior"
    MID = "mid"
    SENIOR = "senior"
    LEAD = "lead"
    EXEC = "exec"


class EmploymentType(str, Enum):
    PERMANENT = "permanent"
    CONTRACT = "contract"
    INTERN = "intern"
    CONSULTANT = "consultant"


class EmploymentStatus(str, Enum):
    DRAFT = "draft"
    ACTIVE = "active"
    PROBATION = "probation"
    CONFIRMED = "confirmed"
    ENDED = "ended"
    CANCELLED = "cancelled"


class AssignmentStatus(str, Enum):
    ACTIVE = "active"
    ENDED = "ended"


class ShiftType(str, Enum):
    GENERAL = "general"
    MORNING = "morning"
    EVENING = "evening"
    NIGHT = "night"
    ROTATIONAL = "rotational"


class ShiftAssignmentStatus(str, Enum):
    DRAFT = "draft"
    SUBMITTED = "submitted"
    APPROVED = "approved"
    ACTIVE = "active"
    ENDED = "ended"
    CANCELLED = "cancelled"


class HolidayCalendarStatus(str, Enum):
    DRAFT = "draft"
    PUBLISHED = "published"
    ARCHIVED = "archived"


class LeaveRequestStatus(str, Enum):
    DRAFT = "draft"
    SUBMITTED = "submitted"
    APPROVED = "approved"
    REJECTED = "rejected"
    CANCELLED = "cancelled"


class LeaveBalanceStatus(str, Enum):
    OPEN = "open"
    CLOSED = "closed"


class AttendanceDayStatus(str, Enum):
    PRESENT = "present"
    ABSENT = "absent"
    HALF_DAY = "half_day"
    WORK_FROM_HOME = "work_from_home"
    HOLIDAY = "holiday"


class AttendanceSource(str, Enum):
    MANUAL = "manual"
    BIOMETRIC = "biometric"
    MOBILE = "mobile"
    WEB = "web"
    DEVICE = "device"


class AttendanceRecordStatus(str, Enum):
    RECORDED = "recorded"
    ADJUSTED = "adjusted"
    LOCKED = "locked"


class DocumentType(str, Enum):
    ID_PROOF = "id_proof"
    ADDRESS_PROOF = "address_proof"
    CONTRACT = "contract"
    CERTIFICATE = "certificate"
    OTHER = "other"


class VerificationStatus(str, Enum):
    PENDING = "pending"
    VERIFIED = "verified"
    REJECTED = "rejected"


class DocumentStatus(str, Enum):
    ACTIVE = "active"
    ARCHIVED = "archived"


class ReviewCycle(str, Enum):
    MONTHLY = "monthly"
    QUARTERLY = "quarterly"
    HALF_YEARLY = "half_yearly"
    YEARLY = "yearly"


class PerformanceReviewStatus(str, Enum):
    DRAFT = "draft"
    IN_PROGRESS = "in_progress"
    SUBMITTED = "submitted"
    APPROVED = "approved"
    CLOSED = "closed"
    CANCELLED = "cancelled"


class GoalStatus(str, Enum):
    OPEN = "open"
    ACHIEVED = "achieved"
    MISSED = "missed"
    CANCELLED = "cancelled"


class AppraisalArea(str, Enum):
    GOALS = "goals"
    KPI = "kpi"
    COMPETENCY = "competency"
    BEHAVIOR = "behavior"
    ATTENDANCE = "attendance"


class AppraisalStatus(str, Enum):
    DRAFT = "draft"
    FINAL = "final"


class TrainingType(str, Enum):
    TECHNICAL = "technical"
    COMPLIANCE = "compliance"
    SOFT_SKILLS = "soft_skills"
    LEADERSHIP = "leadership"


class TrainingStatus(str, Enum):
    PLANNED = "planned"
    IN_PROGRESS = "in_progress"
    COMPLETED = "completed"
    CANCELLED = "cancelled"


class TrainingAttendanceStatus(str, Enum):
    REGISTERED = "registered"
    ATTENDED = "attended"
    ABSENT = "absent"
    COMPLETED = "completed"


class TrainingAttendanceRecordStatus(str, Enum):
    ACTIVE = "active"
    CANCELLED = "cancelled"


class SeparationType(str, Enum):
    RESIGNATION = "resignation"
    TERMINATION = "termination"
    RETIREMENT = "retirement"


class SeparationStatus(str, Enum):
    DRAFT = "draft"
    SUBMITTED = "submitted"
    MANAGER_APPROVED = "manager_approved"
    HR_APPROVED = "hr_approved"
    COMPLETED = "completed"
    CANCELLED = "cancelled"


class HrEntityType(str, Enum):
    EMPLOYMENT = "employment"
    LEAVE_REQUEST = "leave_request"
    SHIFT_ASSIGNMENT = "shift_assignment"
    EMPLOYEE_DOCUMENT = "employee_document"
    PERFORMANCE_REVIEW = "performance_review"
    TRAINING = "training"
    TRAINING_ROOM = "training_room"
    TRAINING_REQUEST = "training_request"
    SEPARATION = "separation"
    DESIGNATION = "designation"
    SHIFT = "shift"
    LEAVE_TYPE = "leave_type"
    HOLIDAY_CALENDAR = "holiday_calendar"


CODE_PREFIXES: dict[HrEntityType, tuple[str, int]] = {
    HrEntityType.EMPLOYMENT: ("EMPL-", 6),
    HrEntityType.LEAVE_REQUEST: ("LVE-", 6),
    HrEntityType.SHIFT_ASSIGNMENT: ("SFA-", 6),
    HrEntityType.EMPLOYEE_DOCUMENT: ("EDOC-", 6),
    HrEntityType.PERFORMANCE_REVIEW: ("PRF-", 6),
    HrEntityType.TRAINING: ("TRN-", 6),
    HrEntityType.TRAINING_ROOM: ("ROOM-", 4),
    HrEntityType.TRAINING_REQUEST: ("MTG-", 6),
    HrEntityType.SEPARATION: ("SEP-", 6),
    HrEntityType.DESIGNATION: ("DES-", 6),
    HrEntityType.SHIFT: ("SFT-", 6),
    HrEntityType.LEAVE_TYPE: ("LT-", 6),
    HrEntityType.HOLIDAY_CALENDAR: ("HOL-", 6),
}
