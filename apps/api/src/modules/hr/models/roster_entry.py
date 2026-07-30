"""HR roster entry ORM — daily employee/shift assignments."""

from datetime import date
from uuid import UUID, uuid4

from sqlalchemy import CheckConstraint, Date, ForeignKey, String, Text, UniqueConstraint
from sqlalchemy.dialects.postgresql import UUID as PG_UUID
from sqlalchemy.orm import Mapped, mapped_column

from database.base import Base
from modules.hr.models.mixins import HrTransactionMixin


class HrRosterEntry(Base, *HrTransactionMixin):
    __tablename__ = "hr_roster_entry"
    __table_args__ = (
        UniqueConstraint(
            "company_id",
            "employee_id",
            "roster_date",
            name="uk_hr_roster_emp_date",
        ),
        CheckConstraint(
            "status IN ('draft','published','cancelled')",
            name="ck_hr_roster_status",
        ),
        {"schema": "hr"},
    )

    id: Mapped[UUID] = mapped_column(PG_UUID(as_uuid=True), primary_key=True, default=uuid4)
    employee_id: Mapped[UUID] = mapped_column(
        PG_UUID(as_uuid=True),
        ForeignKey("master.master_employee.id", ondelete="RESTRICT"),
        nullable=False,
        index=True,
    )
    shift_id: Mapped[UUID] = mapped_column(
        PG_UUID(as_uuid=True),
        ForeignKey("hr.hr_shift.id", ondelete="RESTRICT"),
        nullable=False,
        index=True,
    )
    roster_date: Mapped[date] = mapped_column(Date, nullable=False, index=True)
    status: Mapped[str] = mapped_column(String(30), nullable=False, default="draft", index=True)
    notes: Mapped[str | None] = mapped_column(Text, nullable=True)
