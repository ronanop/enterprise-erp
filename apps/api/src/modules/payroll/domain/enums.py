
"""Payroll domain enums per ERD_12 §11."""

from enum import Enum


class ActiveInactive(str, Enum):
    ACTIVE = "active"
    INACTIVE = "inactive"


class PayrollPeriodStatus(str, Enum):
    OPEN = "open"
    PROCESSING = "processing"
    APPROVED = "approved"
    CLOSED = "closed"
    CANCELLED = "cancelled"


class SalaryStructureStatus(str, Enum):
    DRAFT = "draft"
    ACTIVE = "active"
    INACTIVE = "inactive"


class TaxConfigurationStatus(str, Enum):
    DRAFT = "draft"
    ACTIVE = "active"
    ARCHIVED = "archived"


class EmployeeSalaryStatus(str, Enum):
    DRAFT = "draft"
    ACTIVE = "active"
    ENDED = "ended"
    CANCELLED = "cancelled"


class PayrollRunStatus(str, Enum):
    DRAFT = "draft"
    CALCULATED = "calculated"
    SUBMITTED = "submitted"
    APPROVED = "approved"
    POSTED = "posted"
    PAID = "paid"
    CANCELLED = "cancelled"


class RunLineStatus(str, Enum):
    CALCULATED = "calculated"
    ADJUSTED = "adjusted"
    LOCKED = "locked"
    CANCELLED = "cancelled"


class PayslipStatus(str, Enum):
    GENERATED = "generated"
    ISSUED = "issued"
    VOID = "void"


class DeliveryStatus(str, Enum):
    PENDING = "pending"
    EMAILED = "emailed"
    VIEWED = "viewed"
    FAILED = "failed"


class PaymentStatus(str, Enum):
    UNPAID = "unpaid"
    PROCESSING = "processing"
    PAID = "paid"
    FAILED = "failed"


class BonusStatus(str, Enum):
    DRAFT = "draft"
    SUBMITTED = "submitted"
    APPROVED = "approved"
    PAID = "paid"
    REJECTED = "rejected"
    CANCELLED = "cancelled"


class ReimbursementStatus(str, Enum):
    DRAFT = "draft"
    SUBMITTED = "submitted"
    MANAGER_APPROVED = "manager_approved"
    FINANCE_APPROVED = "finance_approved"
    PAID = "paid"
    REJECTED = "rejected"
    CANCELLED = "cancelled"


class LoanStatus(str, Enum):
    DRAFT = "draft"
    SUBMITTED = "submitted"
    APPROVED = "approved"
    ACTIVE = "active"
    CLOSED = "closed"
    REJECTED = "rejected"
    CANCELLED = "cancelled"


class LoanInstallmentStatus(str, Enum):
    SCHEDULED = "scheduled"
    RECOVERED = "recovered"
    WAIVED = "waived"
    OVERDUE = "overdue"
    CANCELLED = "cancelled"


class AdjustmentStatus(str, Enum):
    DRAFT = "draft"
    APPLIED = "applied"
    CANCELLED = "cancelled"


class PostingStatus(str, Enum):
    DRAFT = "draft"
    SUBMITTED = "submitted"
    POSTED = "posted"
    FAILED = "failed"
    REVERSED = "reversed"


class SummaryStatus(str, Enum):
    DRAFT = "draft"
    FINALIZED = "finalized"


class PayrollPolicyStatus(str, Enum):
    DRAFT = "draft"
    ACTIVE = "active"
    ARCHIVED = "archived"


class PayrollCycleType(str, Enum):
    DAY_20_TO_20 = "day_20_to_20"
    CALENDAR_MONTH = "calendar_month"
    CUSTOM = "custom"


class LeaveBalanceCreditTiming(str, Enum):
    AFTER_CALENDAR_MONTH_END = "after_calendar_month_end"
    ON_FIRST_OF_NEXT_MONTH = "on_first_of_next_month"


class SalaryProrationMode(str, Enum):
    PER_DAY_X_OVER_N = "per_day_x_over_n"
    FIXED_30_DAY_FACTOR = "fixed_30_day_factor"


class PayrollPeriodDayDenominator(str, Enum):
    """N in payable = X × (paid_days / N)."""

    SHIFT_SCHEDULED_DAYS = "shift_scheduled_days"
    ALL_CALENDAR_DAYS_IN_PERIOD = "all_calendar_days_in_period"
    FIXED_30 = "fixed_30"


class PfDeductionMode(str, Enum):
    FIXED_SPLIT = "fixed_split"
    FIXED_TOTAL = "fixed_total"
    STATUTORY_PERCENT = "statutory_percent"


class NetPayFormula(str, Enum):
    GROSS_MINUS_FIXED_PF_TOTAL = "gross_minus_fixed_pf_total"
    GROSS_MINUS_EMPLOYEE_PF_ONLY = "gross_minus_employee_pf_only"


class PayEntityType(str, Enum):
    PAYROLL_RUN = "payroll_run"
    PAYSLIP = "payslip"
    EMPLOYEE_SALARY = "employee_salary"
    BONUS = "bonus"
    REIMBURSEMENT = "reimbursement"
    LOAN = "loan"
    PAYROLL_ADJUSTMENT = "payroll_adjustment"
    PAYROLL_POSTING = "payroll_posting"


CODE_PREFIXES: dict[PayEntityType, tuple[str, int]] = {
    PayEntityType.PAYROLL_RUN: ("PRUN-", 6),
    PayEntityType.PAYSLIP: ("PS-", 6),
    PayEntityType.EMPLOYEE_SALARY: ("ESAL-", 6),
    PayEntityType.BONUS: ("BON-", 6),
    PayEntityType.REIMBURSEMENT: ("REIM-", 6),
    PayEntityType.LOAN: ("LOAN-", 6),
    PayEntityType.PAYROLL_ADJUSTMENT: ("PADJ-", 6),
    PayEntityType.PAYROLL_POSTING: ("PPOST-", 6),
}
