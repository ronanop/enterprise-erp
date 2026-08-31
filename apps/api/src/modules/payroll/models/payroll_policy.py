"""Company payroll policy ORM (Phase 0 — rules lock)."""

from datetime import date
from decimal import Decimal
from uuid import UUID, uuid4

from sqlalchemy import (
    CheckConstraint,
    Date,
    ForeignKey,
    Numeric,
    SmallInteger,
    String,
    Text,
    UniqueConstraint,
)
from sqlalchemy.dialects.postgresql import JSONB
from sqlalchemy.dialects.postgresql import UUID as PG_UUID
from sqlalchemy.orm import Mapped, mapped_column

from database.base import Base
from modules.payroll.models.mixins import PayMasterMixin


class PayPayrollPolicy(Base, *PayMasterMixin):
    __tablename__ = "pay_payroll_policy"
    __table_args__ = (
        UniqueConstraint("company_id", "policy_code", name="uk_pay_policy_company_code"),
        CheckConstraint(
            "status IN ('draft','active','archived')",
            name="ck_pay_policy_status",
        ),
        CheckConstraint(
            "payroll_cycle_type IN ('day_20_to_20','calendar_month','custom')",
            name="ck_pay_policy_pay_cycle",
        ),
        CheckConstraint(
            "leave_cycle_type IN ('day_20_to_20','calendar_month','custom')",
            name="ck_pay_policy_leave_cycle",
        ),
        CheckConstraint(
            "leave_balance_credit_timing IN ('after_calendar_month_end','on_first_of_next_month')",
            name="ck_pay_policy_leave_credit",
        ),
        CheckConstraint(
            "salary_proration_mode IN ('per_day_x_over_n','fixed_30_day_factor')",
            name="ck_pay_policy_proration",
        ),
        CheckConstraint(
            "period_day_denominator IN ('shift_scheduled_days','all_calendar_days_in_period','fixed_30')",
            name="ck_pay_policy_denominator",
        ),
        CheckConstraint(
            "pf_mode IN ('fixed_split','fixed_total','statutory_percent')",
            name="ck_pay_policy_pf_mode",
        ),
        CheckConstraint(
            "net_pay_formula IN ('gross_minus_fixed_pf_total','gross_minus_employee_pf_only')",
            name="ck_pay_policy_net_formula",
        ),
        {"schema": "payroll"},
    )

    id: Mapped[UUID] = mapped_column(PG_UUID(as_uuid=True), primary_key=True, default=uuid4)
    branch_id: Mapped[UUID | None] = mapped_column(
        PG_UUID(as_uuid=True),
        ForeignKey("organization.org_branch.id", ondelete="RESTRICT"),
        nullable=True,
        index=True,
    )
    policy_code: Mapped[str] = mapped_column(String(50), nullable=False)
    policy_name: Mapped[str] = mapped_column(String(255), nullable=False)
    effective_from: Mapped[date] = mapped_column(Date, nullable=False)
    effective_to: Mapped[date | None] = mapped_column(Date, nullable=True)
    status: Mapped[str] = mapped_column(String(30), nullable=False, default="draft", index=True)

    payroll_cycle_type: Mapped[str] = mapped_column(String(40), nullable=False)
    payroll_cycle_start_day: Mapped[int] = mapped_column(SmallInteger, nullable=False, default=20)
    leave_cycle_type: Mapped[str] = mapped_column(String(40), nullable=False)
    leave_balance_credit_timing: Mapped[str] = mapped_column(String(60), nullable=False)

    salary_proration_mode: Mapped[str] = mapped_column(String(40), nullable=False)
    period_day_denominator: Mapped[str] = mapped_column(String(50), nullable=False)
    lop_source: Mapped[str] = mapped_column(String(30), nullable=False, default="attendance")

    basic_percent: Mapped[Decimal] = mapped_column(Numeric(9, 4), nullable=False)
    hra_percent_of_basic: Mapped[Decimal] = mapped_column(Numeric(9, 4), nullable=False)

    pf_mode: Mapped[str] = mapped_column(String(30), nullable=False)
    pf_employee_amount: Mapped[Decimal | None] = mapped_column(Numeric(18, 4), nullable=True)
    pf_employer_amount: Mapped[Decimal | None] = mapped_column(Numeric(18, 4), nullable=True)
    pf_total_amount: Mapped[Decimal | None] = mapped_column(Numeric(18, 4), nullable=True)

    net_pay_formula: Mapped[str] = mapped_column(String(50), nullable=False)
    attendance_rules_json: Mapped[dict | None] = mapped_column(JSONB, nullable=True)
    notes: Mapped[str | None] = mapped_column(Text, nullable=True)
