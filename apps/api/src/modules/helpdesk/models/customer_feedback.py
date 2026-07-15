"""Customer feedback ORM per ERD_17 section 6.14."""

from datetime import datetime
from uuid import UUID, uuid4

from sqlalchemy import CheckConstraint, DateTime, ForeignKey, SmallInteger, String, Text
from sqlalchemy.dialects.postgresql import UUID as PG_UUID
from sqlalchemy.orm import Mapped, mapped_column

from database.base import Base
from modules.helpdesk.models.mixins import HdDetailMixin


class HdCustomerFeedback(Base, *HdDetailMixin):
    __tablename__ = "hd_customer_feedback"
    __table_args__ = (
        CheckConstraint("rating BETWEEN 1 AND 5", name="ck_hd_customer_feedback_rating"),
        CheckConstraint(
            "status IN ('captured','reviewed','archived')",
            name="ck_hd_customer_feedback_status",
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

    ticket_id: Mapped[UUID] = mapped_column(
        PG_UUID(as_uuid=True),
        ForeignKey("helpdesk.hd_ticket.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )
    customer_id: Mapped[UUID] = mapped_column(
        PG_UUID(as_uuid=True),
        ForeignKey("master.master_customer.id", ondelete="RESTRICT"),
        nullable=False,
        index=True,
    )
    rating: Mapped[int] = mapped_column(SmallInteger, nullable=False)
    comments: Mapped[str | None] = mapped_column(Text, nullable=True)
    captured_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False)
    channel: Mapped[str | None] = mapped_column(String(40), nullable=True)
    status: Mapped[str] = mapped_column(String(30), nullable=False, default="captured", index=True)
