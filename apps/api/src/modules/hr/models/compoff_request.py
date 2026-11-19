"""Comp Off allocation request ORM — Emp → Mgr → HR → balance credit."""

from datetime import date, datetime
from decimal import Decimal
from uuid import UUID, uuid4

from sqlalchemy import CheckConstraint, Date, DateTime, ForeignKey, Numeric, String, Text
from sqlalchemy.dialects.postgresql import UUID as PG_UUID
from sqlalchemy.orm import Mapped, mapped_column

from database.base import Base
from modules.hr.models.mixins import HrTransactionMixin


class HrCompoffRequest(Base, *HrTransactionMixin):
    __tablename__ = "hr_compoff_request"
    __table_args__ = (
        CheckConstraint(
            "status IN ('draft','submitted','manager_approved','approved','rejected','cancelled')",
            name="ck_hr_compoff_req_status",
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
    earned_date: Mapped[date] = mapped_column(Date, nullable=False, index=True)
    extra_hours: Mapped[Decimal] = mapped_column(Numeric(6, 2), nullable=False)
    requested_days: Mapped[Decimal] = mapped_column(Numeric(5, 2), nullable=False)
    reason: Mapped[str | None] = mapped_column(Text, nullable=True)
    status: Mapped[str] = mapped_column(String(30), nullable=False, default="draft", index=True)
    manager_approver_id: Mapped[UUID | None] = mapped_column(PG_UUID(as_uuid=True), nullable=True)
    hr_approver_id: Mapped[UUID | None] = mapped_column(PG_UUID(as_uuid=True), nullable=True)
    decided_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
