"""Payroll run line ORM."""

from decimal import Decimal
from uuid import UUID, uuid4

from sqlalchemy import CheckConstraint, ForeignKey, Numeric, String
from sqlalchemy.dialects.postgresql import JSONB
from sqlalchemy.dialects.postgresql import UUID as PG_UUID
from sqlalchemy.orm import Mapped, mapped_column

from database.base import Base
from modules.payroll.models.mixins import PayTransactionMixin


class PayPayrollRunLine(Base, *PayTransactionMixin):
    __tablename__ = "pay_payroll_run_line"
    __table_args__ = (
        CheckConstraint(
            "status IN ('calculated','adjusted','locked','cancelled')",
            name="ck_pay_run_line_status",
        ),
        {"schema": "payroll"},
    )

    id: Mapped[UUID] = mapped_column(PG_UUID(as_uuid=True), primary_key=True, default=uuid4)
    payroll_run_id: Mapped[UUID] = mapped_column(
        PG_UUID(as_uuid=True),
        ForeignKey("payroll.pay_payroll_run.id", ondelete="RESTRICT"),
        nullable=False,
        index=True,
    )
    employee_id: Mapped[UUID] = mapped_column(
        PG_UUID(as_uuid=True),
        ForeignKey("master.master_employee.id", ondelete="RESTRICT"),
        nullable=False,
        index=True,
    )
    employee_salary_id: Mapped[UUID | None] = mapped_column(
        PG_UUID(as_uuid=True),
        ForeignKey("payroll.pay_employee_salary.id", ondelete="RESTRICT"),
        nullable=True,
        index=True,
    )
    department_id: Mapped[UUID | None] = mapped_column(
        PG_UUID(as_uuid=True),
        ForeignKey("organization.org_department.id", ondelete="RESTRICT"),
        nullable=True,
        index=True,
    )
    employment_id: Mapped[UUID] = mapped_column(PG_UUID(as_uuid=True), nullable=False, index=True)
    paid_days: Mapped[Decimal] = mapped_column(Numeric(9, 2), nullable=False, default=0)
    lop_days: Mapped[Decimal] = mapped_column(Numeric(9, 2), nullable=False, default=0)
    leave_days: Mapped[Decimal] = mapped_column(Numeric(9, 2), nullable=False, default=0)
    period_days: Mapped[Decimal] = mapped_column(Numeric(9, 2), nullable=False, default=0)
    primary_shift_id: Mapped[UUID | None] = mapped_column(
        PG_UUID(as_uuid=True),
        ForeignKey("hr.hr_shift.id", ondelete="SET NULL"),
        nullable=True,
        index=True,
    )
    day_summary_json: Mapped[dict | None] = mapped_column(JSONB, nullable=True)
    gross_earnings: Mapped[Decimal] = mapped_column(Numeric(18, 4), nullable=False, default=0)
    total_deductions: Mapped[Decimal] = mapped_column(Numeric(18, 4), nullable=False, default=0)
    net_pay: Mapped[Decimal] = mapped_column(Numeric(18, 4), nullable=False, default=0)
    employer_contribution: Mapped[Decimal] = mapped_column(Numeric(18, 4), nullable=False, default=0)
    component_breakdown_json: Mapped[dict | None] = mapped_column(JSONB, nullable=True)
    status: Mapped[str] = mapped_column(String(30), nullable=False, default="calculated", index=True)
