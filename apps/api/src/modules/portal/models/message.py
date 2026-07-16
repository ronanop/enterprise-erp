"""Message ORM per ERD_23 section 5.7."""

from datetime import datetime
from uuid import UUID, uuid4

from sqlalchemy import CheckConstraint, ForeignKey, Index, String, Text, UniqueConstraint
from sqlalchemy.dialects.postgresql import UUID as PG_UUID
from sqlalchemy.orm import Mapped, mapped_column

from database.base import Base
from modules.portal.models.mixins import PtRowMixin


class PtMessage(Base, *PtRowMixin):
    __tablename__ = "pt_message"
    __table_args__ = (
        UniqueConstraint("company_id", "message_number", name="uk_pt_message_number"),
        CheckConstraint(
            "status IN ('sent','delivered','read','deleted')",
            name="ck_pt_message_status",
        ),
        Index("ix_pt_message_tenant_co_status", "tenant_id", "company_id", "status"),
        {"schema": "portal"},
    )

    id: Mapped[UUID] = mapped_column(PG_UUID(as_uuid=True), primary_key=True, default=uuid4)
    message_number: Mapped[str] = mapped_column(String(50), nullable=False)

    message_thread_id: Mapped[UUID] = mapped_column(
        PG_UUID(as_uuid=True),
        ForeignKey(
            "portal.pt_message_thread.id",
            ondelete="RESTRICT",
        ),
        nullable=False,
        index=True,
    )

    sender_account_id: Mapped[UUID | None] = mapped_column(
        PG_UUID(as_uuid=True),
        ForeignKey(
            "portal.pt_portal_account.id",
            ondelete="SET NULL",
        ),
        nullable=True,
        index=True,
    )

    sender_employee_id: Mapped[UUID | None] = mapped_column(
        PG_UUID(as_uuid=True),
        ForeignKey("master.master_employee.id", ondelete="RESTRICT"),
        nullable=True,
        index=True,
    )
    body: Mapped[str] = mapped_column(Text, nullable=False)
    sent_at: Mapped[datetime | None] = mapped_column(nullable=True)
    status: Mapped[str] = mapped_column(String(30), nullable=False, default="sent", index=True)
