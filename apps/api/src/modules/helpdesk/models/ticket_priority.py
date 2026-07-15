"""Ticket priority ORM per ERD_17 section 6.2."""

from uuid import UUID, uuid4

from sqlalchemy import CheckConstraint, ForeignKey, Integer, SmallInteger, String, UniqueConstraint
from sqlalchemy.dialects.postgresql import UUID as PG_UUID
from sqlalchemy.orm import Mapped, mapped_column

from database.base import Base
from modules.helpdesk.models.mixins import HdMasterMixin


class HdTicketPriority(Base, *HdMasterMixin):
    __tablename__ = "hd_ticket_priority"
    __table_args__ = (
        UniqueConstraint("company_id", "priority_code", name="uk_hd_ticket_priority_code"),
        CheckConstraint(
            "status IN ('active','inactive')",
            name="ck_hd_ticket_priority_status",
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

    priority_code: Mapped[str] = mapped_column(String(50), nullable=False)
    priority_name: Mapped[str] = mapped_column(String(255), nullable=False)
    rank_order: Mapped[int] = mapped_column(SmallInteger, nullable=False, default=1)
    default_response_minutes: Mapped[int | None] = mapped_column(Integer, nullable=True)
    default_resolution_minutes: Mapped[int | None] = mapped_column(Integer, nullable=True)
    status: Mapped[str] = mapped_column(String(30), nullable=False, default="active", index=True)
