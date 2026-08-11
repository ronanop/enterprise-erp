"""Management group (employment type policy) ORM."""

from uuid import UUID, uuid4

from sqlalchemy import CheckConstraint, ForeignKey, String, Text, UniqueConstraint
from sqlalchemy.dialects.postgresql import JSONB
from sqlalchemy.dialects.postgresql import UUID as PG_UUID
from sqlalchemy.orm import Mapped, mapped_column

from database.base import Base
from modules.hr.models.mixins import HrMasterMixin


class HrManagementGroup(Base, *HrMasterMixin):
    __tablename__ = "hr_management_group"
    __table_args__ = (
        UniqueConstraint("company_id", "group_code", name="uk_hr_mgmt_group_company_code"),
        CheckConstraint("status IN ('active','inactive')", name="ck_hr_mgmt_group_status"),
        {"schema": "hr"},
    )

    id: Mapped[UUID] = mapped_column(PG_UUID(as_uuid=True), primary_key=True, default=uuid4)
    group_code: Mapped[str] = mapped_column(String(50), nullable=False)
    group_name: Mapped[str] = mapped_column(String(255), nullable=False)
    description: Mapped[str | None] = mapped_column(Text, nullable=True)
    employment_type: Mapped[str] = mapped_column(String(30), nullable=False, default="permanent")
    status: Mapped[str] = mapped_column(String(30), nullable=False, default="active", index=True)

    default_shift_id: Mapped[UUID] = mapped_column(
        PG_UUID(as_uuid=True),
        ForeignKey("hr.hr_shift.id", ondelete="RESTRICT"),
        nullable=False,
        index=True,
    )
    default_shift_rotation_id: Mapped[UUID | None] = mapped_column(
        PG_UUID(as_uuid=True),
        ForeignKey("hr.hr_shift_rotation.id", ondelete="SET NULL"),
        nullable=True,
    )
    default_attendance_rule_id: Mapped[UUID | None] = mapped_column(
        PG_UUID(as_uuid=True),
        ForeignKey("hr.hr_attendance_rule.id", ondelete="SET NULL"),
        nullable=True,
    )
    default_holiday_calendar_id: Mapped[UUID | None] = mapped_column(
        PG_UUID(as_uuid=True),
        ForeignKey("hr.hr_holiday_calendar.id", ondelete="SET NULL"),
        nullable=True,
    )
    default_weekly_off_policy_id: Mapped[UUID | None] = mapped_column(
        PG_UUID(as_uuid=True),
        ForeignKey("hr.hr_weekly_off_policy.id", ondelete="SET NULL"),
        nullable=True,
    )
    feature_toggles_json: Mapped[dict] = mapped_column(JSONB, nullable=False, default=dict)
