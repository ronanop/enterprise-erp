"""HR weekly-off policy ORM."""

from datetime import date
from uuid import UUID, uuid4

from sqlalchemy import Boolean, CheckConstraint, Date, ForeignKey, String, UniqueConstraint
from sqlalchemy.dialects.postgresql import JSONB
from sqlalchemy.dialects.postgresql import UUID as PG_UUID
from sqlalchemy.orm import Mapped, mapped_column

from database.base import Base
from modules.hr.models.mixins import HrMasterMixin


class HrWeeklyOffPolicy(Base, *HrMasterMixin):
    __tablename__ = "hr_weekly_off_policy"
    __table_args__ = (
        UniqueConstraint("company_id", "policy_code", name="uk_hr_weekly_off_company_code"),
        CheckConstraint("status IN ('active','inactive')", name="ck_hr_weekly_off_status"),
        {"schema": "hr"},
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
    # e.g. ["sunday", "second_saturday"]
    rules_json: Mapped[list | None] = mapped_column(JSONB, nullable=True)
    # weekday ints 0=Mon … 6=Sun when "custom" is in rules_json
    custom_weekdays_json: Mapped[list | None] = mapped_column(JSONB, nullable=True)
    alternate_saturday_start: Mapped[date | None] = mapped_column(Date, nullable=True)
    is_default: Mapped[bool] = mapped_column(Boolean, nullable=False, default=True)
    status: Mapped[str] = mapped_column(String(30), nullable=False, default="active", index=True)
