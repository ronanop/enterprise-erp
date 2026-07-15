"""Support shift ORM per ERD_17 section 6.16."""

from datetime import time
from uuid import UUID, uuid4

from sqlalchemy import CheckConstraint, ForeignKey, String, Time, UniqueConstraint
from sqlalchemy.dialects.postgresql import UUID as PG_UUID
from sqlalchemy.orm import Mapped, mapped_column

from database.base import Base
from modules.helpdesk.models.mixins import HdDetailMixin


class HdSupportShift(Base, *HdDetailMixin):
    __tablename__ = "hd_support_shift"
    __table_args__ = (
        UniqueConstraint("support_team_id", "shift_code", name="uk_hd_support_shift_code"),
        CheckConstraint(
            "status IN ('active','inactive')",
            name="ck_hd_support_shift_status",
        ),
        {"schema": "helpdesk"},
    )

    id: Mapped[UUID] = mapped_column(PG_UUID(as_uuid=True), primary_key=True, default=uuid4)

    branch_id: Mapped[UUID | None] = mapped_column(
        PG_UUID(as_uuid=True),
        ForeignKey("organization.org_branch.id", ondelete="RESTRICT"),
        nullable=True,
        index=True,
    )

    support_team_id: Mapped[UUID] = mapped_column(
        PG_UUID(as_uuid=True),
        ForeignKey("helpdesk.hd_support_team.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )
    shift_code: Mapped[str] = mapped_column(String(50), nullable=False)
    shift_name: Mapped[str] = mapped_column(String(255), nullable=False)
    start_time: Mapped[time] = mapped_column(Time, nullable=False)
    end_time: Mapped[time] = mapped_column(Time, nullable=False)
    timezone: Mapped[str] = mapped_column(String(64), nullable=False, default="UTC")
    status: Mapped[str] = mapped_column(String(30), nullable=False, default="active", index=True)
