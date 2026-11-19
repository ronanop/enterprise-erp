"""Ownership / co-owner change history for service request tickets."""

from datetime import datetime
from uuid import UUID, uuid4

from sqlalchemy import CheckConstraint, DateTime, ForeignKey, String, Text, func
from sqlalchemy.dialects.postgresql import UUID as PG_UUID
from sqlalchemy.orm import Mapped, mapped_column

from database.base import Base

ASSIGNMENT_CHANGE_TYPES = ("assign", "reassign", "co_owner_add", "co_owner_remove")


class SvcTicketAssignmentHistory(Base):
    """Append-only log (no soft delete) of owner assignment and co-owner changes."""

    __tablename__ = "svc_ticket_assignment_history"
    __table_args__ = (
        CheckConstraint(
            "change_type IN ('assign','reassign','co_owner_add','co_owner_remove')",
            name="ck_svc_ticket_assignment_history_type",
        ),
        {"schema": "service"},
    )

    id: Mapped[UUID] = mapped_column(PG_UUID(as_uuid=True), primary_key=True, default=uuid4)
    tenant_id: Mapped[UUID] = mapped_column(PG_UUID(as_uuid=True), nullable=False, index=True)
    company_id: Mapped[UUID] = mapped_column(PG_UUID(as_uuid=True), nullable=False, index=True)
    request_id: Mapped[UUID] = mapped_column(
        PG_UUID(as_uuid=True),
        ForeignKey("service.svc_service_request.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )
    # For co_owner_add: new_owner_employee_id = co-owner added.
    # For co_owner_remove: old_owner_employee_id = co-owner removed.
    old_owner_employee_id: Mapped[UUID | None] = mapped_column(PG_UUID(as_uuid=True), nullable=True)
    new_owner_employee_id: Mapped[UUID | None] = mapped_column(PG_UUID(as_uuid=True), nullable=True)
    reason: Mapped[str | None] = mapped_column(Text, nullable=True)
    changed_by: Mapped[UUID | None] = mapped_column(PG_UUID(as_uuid=True), nullable=True)
    changed_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False)
    change_type: Mapped[str] = mapped_column(String(30), nullable=False)
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), nullable=False
    )
