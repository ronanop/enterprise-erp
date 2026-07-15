"""Ticket SLA ORM per ERD_17 section 6.9."""

from uuid import UUID, uuid4

from sqlalchemy import (
    Boolean,
    CheckConstraint,
    ForeignKey,
    Index,
    Integer,
    String,
    UniqueConstraint,
)
from sqlalchemy.dialects.postgresql import UUID as PG_UUID
from sqlalchemy.orm import Mapped, mapped_column

from database.base import Base
from modules.helpdesk.models.mixins import HdMasterMixin


class HdTicketSla(Base, *HdMasterMixin):
    __tablename__ = "hd_ticket_sla"
    __table_args__ = (
        UniqueConstraint("company_id", "sla_code", name="uk_hd_ticket_sla_code"),
        CheckConstraint(
            "status IN ('active','inactive')",
            name="ck_hd_ticket_sla_status",
        ),
        # Explicit name: avoids collision with hd_ticket.sla_status → ix_helpdesk_hd_ticket_sla_status
        Index("ix_hd_ticket_sla_row_status", "status"),
        {"schema": "helpdesk"},
    )

    id: Mapped[UUID] = mapped_column(PG_UUID(as_uuid=True), primary_key=True, default=uuid4)

    branch_id: Mapped[UUID | None] = mapped_column(
        PG_UUID(as_uuid=True),
        ForeignKey("organization.org_branch.id", ondelete="RESTRICT"),
        nullable=True,
        index=True,
    )

    sla_code: Mapped[str] = mapped_column(String(50), nullable=False)
    sla_name: Mapped[str] = mapped_column(String(255), nullable=False)
    priority_id: Mapped[UUID | None] = mapped_column(
        PG_UUID(as_uuid=True),
        ForeignKey("helpdesk.hd_ticket_priority.id", ondelete="SET NULL"),
        nullable=True,
        index=True,
    )
    response_minutes: Mapped[int] = mapped_column(Integer, nullable=False)
    resolution_minutes: Mapped[int] = mapped_column(Integer, nullable=False)
    business_hours_only: Mapped[bool] = mapped_column(Boolean, nullable=False, default=True)
    status: Mapped[str] = mapped_column(String(30), nullable=False, default="active")
