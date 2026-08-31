"""HR attendance rule ORM — half-day hours, geo, early-leave, arrival window, punch mode."""

from datetime import time
from decimal import Decimal
from uuid import UUID, uuid4

from sqlalchemy import (
    Boolean,
    CheckConstraint,
    ForeignKey,
    Integer,
    Numeric,
    String,
    Time,
    UniqueConstraint,
)
from sqlalchemy.dialects.postgresql import JSONB, UUID as PG_UUID
from sqlalchemy.orm import Mapped, mapped_column

from database.base import Base
from modules.hr.models.mixins import HrMasterMixin


class HrAttendanceRule(Base, *HrMasterMixin):
    __tablename__ = "hr_attendance_rule"
    __table_args__ = (
        UniqueConstraint("company_id", "rule_code", name="uk_hr_att_rule_company_code"),
        CheckConstraint("status IN ('active','inactive')", name="ck_hr_att_rule_status"),
        CheckConstraint(
            "punch_mode IN ('first_in_last_out','every_punch')",
            name="ck_hr_att_rule_punch_mode",
        ),
        CheckConstraint(
            "arrival_after_status IN ('half_day','absent','late')",
            name="ck_hr_att_rule_arrival_after",
        ),
        {"schema": "hr"},
    )

    id: Mapped[UUID] = mapped_column(PG_UUID(as_uuid=True), primary_key=True, default=uuid4)
    branch_id: Mapped[UUID | None] = mapped_column(
        PG_UUID(as_uuid=True),
        ForeignKey("organization.org_branch.id", ondelete="RESTRICT"),
        nullable=True,
        index=True,
    )
    rule_code: Mapped[str] = mapped_column(String(50), nullable=False)
    rule_name: Mapped[str] = mapped_column(String(255), nullable=False)
    grace_minutes: Mapped[int] = mapped_column(Integer, nullable=False, default=15)
    late_mark_after_minutes: Mapped[int] = mapped_column(Integer, nullable=False, default=15)
    half_day_hours: Mapped[Decimal] = mapped_column(Numeric(5, 2), nullable=False, default=Decimal("4.00"))
    full_day_hours: Mapped[Decimal] = mapped_column(Numeric(5, 2), nullable=False, default=Decimal("8.00"))
    early_leave_half_day_minutes: Mapped[int] = mapped_column(Integer, nullable=False, default=120)
    overtime_allowed: Mapped[bool] = mapped_column(Boolean, nullable=False, default=True)
    geofence_required: Mapped[bool] = mapped_column(Boolean, nullable=False, default=False)
    ess_selfie_required: Mapped[bool] = mapped_column(Boolean, nullable=False, default=False)
    ess_face_at_punch_required: Mapped[bool] = mapped_column(Boolean, nullable=False, default=False)
    miss_punch_window_hours: Mapped[int] = mapped_column(Integer, nullable=False, default=48)
    compoff_half_day_hours: Mapped[Decimal] = mapped_column(
        Numeric(5, 2), nullable=False, default=Decimal("4.00")
    )
    compoff_full_day_hours: Mapped[Decimal] = mapped_column(
        Numeric(5, 2), nullable=False, default=Decimal("8.00")
    )
    compoff_auto_credit: Mapped[bool] = mapped_column(Boolean, nullable=False, default=True)
    # Policy maker — biometric + arrival window
    punch_mode: Mapped[str] = mapped_column(String(40), nullable=False, default="first_in_last_out")
    arrival_policy_enabled: Mapped[bool] = mapped_column(Boolean, nullable=False, default=False)
    applies_to_all_shifts: Mapped[bool] = mapped_column(Boolean, nullable=False, default=True)
    arrival_window_start: Mapped[time | None] = mapped_column(Time, nullable=True)
    arrival_ok_until: Mapped[time | None] = mapped_column(Time, nullable=True)
    arrival_after_status: Mapped[str] = mapped_column(String(30), nullable=False, default="half_day")
    # Per-shift overrides: [{shift_id, shift_code, window_start, ok_until, after_status}]
    shift_windows_json: Mapped[list | None] = mapped_column(JSONB, nullable=True)
    is_default: Mapped[bool] = mapped_column(Boolean, nullable=False, default=True)
    status: Mapped[str] = mapped_column(String(30), nullable=False, default="active", index=True)
