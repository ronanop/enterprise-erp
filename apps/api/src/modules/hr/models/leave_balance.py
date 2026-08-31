"""HR leave balance ORM."""

from decimal import Decimal
from uuid import UUID, uuid4

from sqlalchemy import CheckConstraint, ForeignKey, Numeric, SmallInteger, String, UniqueConstraint
from sqlalchemy.dialects.postgresql import UUID as PG_UUID
from sqlalchemy.orm import Mapped, mapped_column

from database.base import Base
from modules.hr.models.mixins import HrTransactionMixin


class HrLeaveBalance(Base, *HrTransactionMixin):
    __tablename__ = "hr_leave_balance"
    __table_args__ = (
        UniqueConstraint(
            "company_id",
            "employee_id",
            "leave_type_id",
            "balance_year",
            name="uk_hr_lbal_emp_type_year",
        ),
        CheckConstraint("status IN ('open','closed')", name="ck_hr_lbal_status"),
        {"schema": "hr"},
    )

    id: Mapped[UUID] = mapped_column(PG_UUID(as_uuid=True), primary_key=True, default=uuid4)
    employee_id: Mapped[UUID] = mapped_column(
        PG_UUID(as_uuid=True),
        ForeignKey("master.master_employee.id", ondelete="RESTRICT"),
        nullable=False,
        index=True,
    )
    leave_type_id: Mapped[UUID] = mapped_column(
        PG_UUID(as_uuid=True),
        ForeignKey("hr.hr_leave_type.id", ondelete="RESTRICT"),
        nullable=False,
        index=True,
    )
    balance_year: Mapped[int] = mapped_column(SmallInteger, nullable=False)
    opening_balance: Mapped[Decimal] = mapped_column(Numeric(9, 2), nullable=False, default=0)
    accrued: Mapped[Decimal] = mapped_column(Numeric(9, 2), nullable=False, default=0)
    used: Mapped[Decimal] = mapped_column(Numeric(9, 2), nullable=False, default=0)
    closing_balance: Mapped[Decimal] = mapped_column(Numeric(9, 2), nullable=False, default=0)
    status: Mapped[str] = mapped_column(String(30), nullable=False, default="open", index=True)
    last_accrual_yyyymm: Mapped[str | None] = mapped_column(String(7), nullable=True)
