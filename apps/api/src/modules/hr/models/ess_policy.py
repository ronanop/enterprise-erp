"""ESS policy walkthrough ORM (Phase 6)."""

from datetime import datetime
from uuid import UUID, uuid4

from sqlalchemy import (
    Boolean,
    CheckConstraint,
    DateTime,
    ForeignKey,
    Integer,
    String,
    Text,
    UniqueConstraint,
)
from sqlalchemy.dialects.postgresql import UUID as PG_UUID
from sqlalchemy.orm import Mapped, mapped_column

from database.base import Base
from modules.hr.models.mixins import HrMasterMixin


class HrEssPolicy(Base, *HrMasterMixin):
    __tablename__ = "hr_ess_policy"
    __table_args__ = (
        UniqueConstraint("company_id", "policy_code", name="uk_hr_ess_policy_company_code"),
        CheckConstraint(
            "status IN ('draft','published','archived')",
            name="ck_hr_ess_policy_status",
        ),
        {"schema": "hr"},
    )

    id: Mapped[UUID] = mapped_column(PG_UUID(as_uuid=True), primary_key=True, default=uuid4)
    policy_code: Mapped[str] = mapped_column(String(50), nullable=False)
    title: Mapped[str] = mapped_column(String(255), nullable=False)
    policy_version: Mapped[int] = mapped_column(Integer, nullable=False, default=1)
    content_markdown: Mapped[str] = mapped_column(Text, nullable=False)
    is_mandatory: Mapped[bool] = mapped_column(Boolean, nullable=False, default=True)
    display_order: Mapped[int] = mapped_column(Integer, nullable=False, default=0)
    published_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    status: Mapped[str] = mapped_column(String(30), nullable=False, default="published", index=True)


class HrEssPolicyAck(Base, *HrMasterMixin):
    __tablename__ = "hr_ess_policy_ack"
    __table_args__ = (
        UniqueConstraint(
            "employee_id",
            "policy_id",
            "policy_version",
            name="uk_hr_ess_policy_ack_emp_policy_ver",
        ),
        {"schema": "hr"},
    )

    id: Mapped[UUID] = mapped_column(PG_UUID(as_uuid=True), primary_key=True, default=uuid4)
    policy_id: Mapped[UUID] = mapped_column(
        PG_UUID(as_uuid=True),
        ForeignKey("hr.hr_ess_policy.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )
    employee_id: Mapped[UUID] = mapped_column(
        PG_UUID(as_uuid=True),
        ForeignKey("master.master_employee.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )
    policy_version: Mapped[int] = mapped_column(Integer, nullable=False)
    acknowledged_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False)
