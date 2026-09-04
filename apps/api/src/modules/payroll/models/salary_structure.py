"""Salary structure catalog ORM."""

from datetime import date
from decimal import Decimal
from uuid import UUID, uuid4

from sqlalchemy import CheckConstraint, Date, ForeignKey, Numeric, String, UniqueConstraint
from sqlalchemy.dialects.postgresql import UUID as PG_UUID
from sqlalchemy.orm import Mapped, mapped_column

from database.base import Base
from modules.payroll.models.mixins import PayMasterMixin


class PaySalaryStructure(Base, *PayMasterMixin):
    __tablename__ = "pay_salary_structure"
    __table_args__ = (
        UniqueConstraint("company_id", "structure_code", name="uk_pay_struct_company_code"),
        CheckConstraint("status IN ('draft','active','inactive')", name="ck_pay_struct_status"),
        {"schema": "payroll"},
    )

    id: Mapped[UUID] = mapped_column(PG_UUID(as_uuid=True), primary_key=True, default=uuid4)
    branch_id: Mapped[UUID | None] = mapped_column(
        PG_UUID(as_uuid=True),
        ForeignKey("organization.org_branch.id", ondelete="RESTRICT"),
        nullable=True,
        index=True,
    )
    structure_code: Mapped[str] = mapped_column(String(50), nullable=False)
    structure_name: Mapped[str] = mapped_column(String(255), nullable=False)
    effective_from: Mapped[date] = mapped_column(Date, nullable=False)
    effective_to: Mapped[date | None] = mapped_column(Date, nullable=True)
    currency_code: Mapped[str] = mapped_column(String(10), nullable=False)
    status: Mapped[str] = mapped_column(String(30), nullable=False, default="draft", index=True)

    gross_ctc: Mapped[Decimal] = mapped_column(Numeric(18, 4), nullable=False, default=Decimal("0"))
    basic_percent: Mapped[Decimal] = mapped_column(Numeric(9, 4), nullable=False, default=Decimal("0.6000"))
    hra_percent_of_basic: Mapped[Decimal] = mapped_column(
        Numeric(9, 4), nullable=False, default=Decimal("0.5000")
    )
    telephone_allowance: Mapped[Decimal] = mapped_column(Numeric(18, 4), nullable=False, default=Decimal("0"))
    employer_contribution: Mapped[Decimal] = mapped_column(
        Numeric(18, 4), nullable=False, default=Decimal("1800")
    )
    basic_amount: Mapped[Decimal] = mapped_column(Numeric(18, 4), nullable=False, default=Decimal("0"))
    hra_amount: Mapped[Decimal] = mapped_column(Numeric(18, 4), nullable=False, default=Decimal("0"))
    special_allowance: Mapped[Decimal] = mapped_column(Numeric(18, 4), nullable=False, default=Decimal("0"))
    ctc_amount: Mapped[Decimal] = mapped_column(Numeric(18, 4), nullable=False, default=Decimal("0"))
    pf_percent: Mapped[Decimal] = mapped_column(Numeric(9, 4), nullable=False, default=Decimal("0.1200"))
    pf_wage_ceiling: Mapped[Decimal] = mapped_column(Numeric(18, 4), nullable=False, default=Decimal("15000"))
    pf_fixed_ceiling: Mapped[Decimal] = mapped_column(Numeric(18, 4), nullable=False, default=Decimal("1800"))
    edli_admin_amount: Mapped[Decimal] = mapped_column(Numeric(18, 4), nullable=False, default=Decimal("100"))
    esi_percent: Mapped[Decimal] = mapped_column(Numeric(9, 4), nullable=False, default=Decimal("0.0075"))
    esi_monthly_ceiling: Mapped[Decimal] = mapped_column(
        Numeric(18, 4), nullable=False, default=Decimal("21000")
    )
