"""Document notification ORM per ERD_18 section 6.19."""

from datetime import datetime
from uuid import UUID, uuid4

from sqlalchemy import CheckConstraint, DateTime, ForeignKey, String
from sqlalchemy.dialects.postgresql import JSONB
from sqlalchemy.dialects.postgresql import UUID as PG_UUID
from sqlalchemy.orm import Mapped, mapped_column

from database.base import Base
from modules.document.models.mixins import DocDetailMixin


class DocNotification(Base, *DocDetailMixin):
    __tablename__ = "doc_notification"
    __table_args__ = (
        CheckConstraint(
            "notification_type IN ('approval_due','review_due','checkout_overdue','expiry',"
            "'retention','archived','shared','other')",
            name="ck_doc_notification_type",
        ),
        CheckConstraint(
            "delivery_status IN ('pending','sent','failed','read')",
            name="ck_doc_notification_delivery",
        ),
        CheckConstraint("status IN ('active','archived')", name="ck_doc_notification_status"),
        {"schema": "document"},
    )

    id: Mapped[UUID] = mapped_column(PG_UUID(as_uuid=True), primary_key=True, default=uuid4)

    document_id: Mapped[UUID | None] = mapped_column(
        PG_UUID(as_uuid=True),
        ForeignKey("document.doc_document.id", ondelete="RESTRICT"),
        nullable=True,
        index=True,
    )
    notification_type: Mapped[str] = mapped_column(String(40), nullable=False)
    recipient_user_id: Mapped[UUID | None] = mapped_column(PG_UUID(as_uuid=True), nullable=True)

    recipient_employee_id: Mapped[UUID | None] = mapped_column(
        PG_UUID(as_uuid=True),
        ForeignKey("master.master_employee.id", ondelete="RESTRICT"),
        nullable=True,
        index=True,
    )
    payload_json: Mapped[dict | None] = mapped_column(JSONB, nullable=True)
    sent_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    delivery_status: Mapped[str] = mapped_column(String(30), nullable=False, default="pending")
    status: Mapped[str] = mapped_column(String(30), nullable=False, default="active", index=True)
