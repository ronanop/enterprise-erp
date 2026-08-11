"""HR leave type catalog ORM."""

from decimal import Decimal
from uuid import UUID, uuid4

from sqlalchemy import Boolean, CheckConstraint, ForeignKey, Numeric, SmallInteger, String, UniqueConstraint
from sqlalchemy.dialects.postgresql import UUID as PG_UUID
from sqlalchemy.orm import Mapped, mapped_column

from database.base import Base
from modules.hr.models.mixins import HrMasterMixin


class HrLeaveType(Base, *HrMasterMixin):
    __tablename__ = "hr_leave_type"
    __table_args__ = (
        UniqueConstraint("company_id", "leave_type_code", name="uk_hr_ltype_company_code"),
        CheckConstraint("status IN ('active','inactive')", name="ck_hr_ltype_status"),
        {"schema": "hr"},
    )

    id: Mapped[UUID] = mapped_column(PG_UUID(as_uuid=True), primary_key=True, default=uuid4)
    branch_id: Mapped[UUID | None] = mapped_column(
        PG_UUID(as_uuid=True),
        ForeignKey("organization.org_branch.id", ondelete="RESTRICT"),
        nullable=True,
        index=True,
    )
    leave_type_code: Mapped[str] = mapped_column(String(50), nullable=False)
    leave_type_name: Mapped[str] = mapped_column(String(255), nullable=False)
    is_paid: Mapped[bool] = mapped_column(Boolean, nullable=False, default=True)
    max_days_per_year: Mapped[Decimal | None] = mapped_column(Numeric(9, 2), nullable=True)
    requires_attachment: Mapped[bool] = mapped_column(Boolean, nullable=False, default=False)
    carry_forward_allowed: Mapped[bool] = mapped_column(Boolean, nullable=False, default=False)
    max_carry_forward_days: Mapped[Decimal | None] = mapped_column(Numeric(9, 2), nullable=True)
    encashment_allowed: Mapped[bool] = mapped_column(Boolean, nullable=False, default=False)
    monthly_credit_days: Mapped[Decimal | None] = mapped_column(Numeric(9, 2), nullable=True)
    leave_cycle_start_day: Mapped[int] = mapped_column(SmallInteger, nullable=False, default=1)
    sandwich_rule_enabled: Mapped[bool] = mapped_column(Boolean, nullable=False, default=False)
    status: Mapped[str] = mapped_column(String(30), nullable=False, default="active", index=True)
