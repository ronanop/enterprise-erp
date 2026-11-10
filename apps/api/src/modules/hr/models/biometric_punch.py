"""Biometric punch log — one row per device punch (merge across machines)."""

from datetime import date, datetime
from uuid import UUID, uuid4

from sqlalchemy import Date, DateTime, ForeignKey, Index, String, Text, text
from sqlalchemy.dialects.postgresql import UUID as PG_UUID
from sqlalchemy.orm import Mapped, mapped_column

from database.base import Base
from modules.hr.models.mixins import HrTransactionMixin


class HrBiometricPunch(Base, *HrTransactionMixin):
    """Raw biometric punches retained for multi-device merge + policy status."""

    __tablename__ = "hr_biometric_punch"
    __table_args__ = (
        Index(
            "uk_hr_bio_punch_live",
            "company_id",
            "device_code",
            "employee_code_raw",
            "punched_at",
            unique=True,
            postgresql_where=text("is_deleted = false"),
        ),
        Index("ix_hr_bio_punch_emp_date", "employee_id", "attendance_date"),
        Index("ix_hr_bio_punch_device_date", "device_id", "attendance_date"),
        {"schema": "hr"},
    )

    id: Mapped[UUID] = mapped_column(PG_UUID(as_uuid=True), primary_key=True, default=uuid4)
    device_id: Mapped[UUID | None] = mapped_column(
        PG_UUID(as_uuid=True),
        ForeignKey("hr.hr_biometric_device.id", ondelete="SET NULL"),
        nullable=True,
        index=True,
    )
    device_code: Mapped[str] = mapped_column(String(50), nullable=False)
    employee_id: Mapped[UUID | None] = mapped_column(
        PG_UUID(as_uuid=True),
        ForeignKey("master.master_employee.id", ondelete="RESTRICT"),
        nullable=True,
        index=True,
    )
    employee_code_raw: Mapped[str] = mapped_column(String(50), nullable=False)
    punched_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False, index=True)
    attendance_date: Mapped[date] = mapped_column(Date, nullable=False, index=True)
    notes: Mapped[str | None] = mapped_column(Text, nullable=True)
