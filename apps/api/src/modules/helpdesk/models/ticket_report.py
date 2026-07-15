"""Ticket report ORM per ERD_17 section 6.19."""

from datetime import date, datetime
from uuid import UUID, uuid4

from sqlalchemy import CheckConstraint, Date, DateTime, ForeignKey, String, UniqueConstraint
from sqlalchemy.dialects.postgresql import JSONB
from sqlalchemy.dialects.postgresql import UUID as PG_UUID
from sqlalchemy.orm import Mapped, mapped_column

from database.base import Base
from modules.helpdesk.models.mixins import HdDetailMixin


class HdTicketReport(Base, *HdDetailMixin):
    __tablename__ = "hd_ticket_report"
    __table_args__ = (
        UniqueConstraint("company_id", "report_code", name="uk_hd_ticket_report_code"),
        CheckConstraint(
            "status IN ('draft','finalized')",
            name="ck_hd_ticket_report_status",
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

    report_code: Mapped[str] = mapped_column(String(50), nullable=False)
    report_type: Mapped[str] = mapped_column(String(40), nullable=False)
    period_start: Mapped[date] = mapped_column(Date, nullable=False)
    period_end: Mapped[date] = mapped_column(Date, nullable=False)
    category_id: Mapped[UUID | None] = mapped_column(
        PG_UUID(as_uuid=True),
        ForeignKey("helpdesk.hd_ticket_category.id", ondelete="SET NULL"),
        nullable=True,
        index=True,
    )
    team_id: Mapped[UUID | None] = mapped_column(
        PG_UUID(as_uuid=True),
        ForeignKey("helpdesk.hd_support_team.id", ondelete="SET NULL"),
        nullable=True,
        index=True,
    )
    department_id: Mapped[UUID | None] = mapped_column(
        PG_UUID(as_uuid=True),
        ForeignKey("organization.org_department.id", ondelete="SET NULL"),
        nullable=True,
        index=True,
    )
    metrics_json: Mapped[dict | None] = mapped_column(JSONB, nullable=True)
    generated_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    status: Mapped[str] = mapped_column(String(30), nullable=False, default="draft", index=True)
