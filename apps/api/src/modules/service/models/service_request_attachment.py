"""Attachment metadata + binary content for service request tickets."""

from datetime import datetime
from uuid import UUID, uuid4

from sqlalchemy import BigInteger, Boolean, DateTime, ForeignKey, LargeBinary, String
from sqlalchemy.dialects.postgresql import UUID as PG_UUID
from sqlalchemy.orm import Mapped, mapped_column

from database.base import Base


class SvcServiceRequestAttachment(Base):
    __tablename__ = "svc_service_request_attachment"
    __table_args__ = ({"schema": "service"},)

    id: Mapped[UUID] = mapped_column(PG_UUID(as_uuid=True), primary_key=True, default=uuid4)
    tenant_id: Mapped[UUID] = mapped_column(PG_UUID(as_uuid=True), nullable=False, index=True)
    company_id: Mapped[UUID] = mapped_column(PG_UUID(as_uuid=True), nullable=False, index=True)
    branch_id: Mapped[UUID | None] = mapped_column(PG_UUID(as_uuid=True), nullable=True)
    request_id: Mapped[UUID] = mapped_column(
        PG_UUID(as_uuid=True),
        ForeignKey("service.svc_service_request.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )
    file_name: Mapped[str] = mapped_column(String(500), nullable=False)
    content_type: Mapped[str | None] = mapped_column(String(200), nullable=True)
    # Legacy disk path (optional). Prefer file_content in PostgreSQL.
    file_path: Mapped[str | None] = mapped_column(String(1000), nullable=True)
    file_content: Mapped[bytes | None] = mapped_column(LargeBinary, nullable=True)
    file_size: Mapped[int | None] = mapped_column(BigInteger, nullable=True)
    uploaded_by: Mapped[UUID | None] = mapped_column(PG_UUID(as_uuid=True), nullable=True)
    # When set, this file is part of a field engineer's work report
    field_engineer_id: Mapped[UUID | None] = mapped_column(
        PG_UUID(as_uuid=True),
        ForeignKey("service.svc_ticket_field_engineer.id", ondelete="SET NULL"),
        nullable=True,
        index=True,
    )
    uploaded_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False)
    status: Mapped[str] = mapped_column(String(30), nullable=False, default="active")
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False)
    created_by: Mapped[UUID | None] = mapped_column(PG_UUID(as_uuid=True), nullable=True)
    is_deleted: Mapped[bool] = mapped_column(Boolean, nullable=False, default=False)
