"""Payroll run header ORM."""

from datetime import date
from decimal import Decimal
from uuid import UUID, uuid4

from sqlalchemy import CheckConstraint, Date, ForeignKey, Integer, Numeric, String, UniqueConstraint
from sqlalchemy.dialects.postgresql import UUID as PG_UUID
from sqlalchemy.orm import Mapped, mapped_column

from database.base import Base
from modules.payroll.models.mixins import PayTransactionMixin


class PayPayrollRun(Base, *PayTransactionMixin):
    __tablename__ = "pay_payroll_run"
    __table_args__ = (
        UniqueConstraint("company_id", "document_number", name="uk_pay_run_company_doc"),
        CheckConstraint(
            "run_type IN ('regular','off_cycle','final_settlement')",
            name="ck_pay_run_type",
        ),
        CheckConstraint(
            "status IN ('draft','calculated','submitted','approved','posted','paid','cancelled')",
            name="ck_pay_run_status",
        ),
        {"schema": "payroll"},
    )

    id: Mapped[UUID] = mapped_column(PG_UUID(as_uuid=True), primary_key=True, default=uuid4)
    document_number: Mapped[str] = mapped_column(String(50), nullable=False)
    payroll_period_id: Mapped[UUID] = mapped_column(
        PG_UUID(as_uuid=True),
        ForeignKey("payroll.pay_payroll_period.id", ondelete="RESTRICT"),
        nullable=False,
        index=True,
    )
    run_date: Mapped[date] = mapped_column(Date, nullable=False)
    run_type: Mapped[str] = mapped_column(String(30), nullable=False, default="regular")
    employee_count: Mapped[int] = mapped_column(Integer, nullable=False, default=0)
    total_gross: Mapped[Decimal] = mapped_column(Numeric(18, 4), nullable=False, default=0)
    total_deduction: Mapped[Decimal] = mapped_column(Numeric(18, 4), nullable=False, default=0)
    total_net: Mapped[Decimal] = mapped_column(Numeric(18, 4), nullable=False, default=0)
    total_employer_cost: Mapped[Decimal] = mapped_column(Numeric(18, 4), nullable=False, default=0)
    currency_code: Mapped[str] = mapped_column(String(10), nullable=False)
    target_employee_id: Mapped[UUID | None] = mapped_column(
        PG_UUID(as_uuid=True),
        ForeignKey("master.master_employee.id", ondelete="SET NULL"),
        nullable=True,
        index=True,
    )
    status: Mapped[str] = mapped_column(String(30), nullable=False, default="draft", index=True)
    workflow_status: Mapped[str | None] = mapped_column(String(30), nullable=True)
    workflow_instance_id: Mapped[UUID | None] = mapped_column(
        PG_UUID(as_uuid=True),
        ForeignKey("foundation.wf_instance.id", ondelete="SET NULL"),
        nullable=True,
    )
