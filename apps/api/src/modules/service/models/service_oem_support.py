"""OEM support details for service requests."""

from datetime import datetime
from uuid import UUID, uuid4

from sqlalchemy import DateTime, ForeignKey, String, Text
from sqlalchemy.dialects.postgresql import UUID as PG_UUID
from sqlalchemy.orm import Mapped, mapped_column

from database.base import Base
from database.mixins import AuditMixin, CompanyMixin, SoftDeleteMixin, TenantMixin, VersionMixin


class SvcServiceOemSupport(Base, AuditMixin, TenantMixin, CompanyMixin, SoftDeleteMixin, VersionMixin):
    __tablename__ = "svc_service_oem_support"
    __table_args__ = ({"schema": "service"},)

    id: Mapped[UUID] = mapped_column(PG_UUID(as_uuid=True), primary_key=True, default=uuid4)
    branch_id: Mapped[UUID | None] = mapped_column(
        PG_UUID(as_uuid=True),
        ForeignKey("organization.org_branch.id", ondelete="RESTRICT"),
        nullable=True,
        index=True,
    )
    request_id: Mapped[UUID] = mapped_column(
        PG_UUID(as_uuid=True),
        ForeignKey("service.svc_service_request.id", ondelete="CASCADE"),
        nullable=False,
        unique=True,
        index=True,
    )
    oem_name: Mapped[str | None] = mapped_column(String(255), nullable=True)
    oem_ticket_number: Mapped[str | None] = mapped_column(String(100), nullable=True)
    customer_reference: Mapped[str | None] = mapped_column(String(100), nullable=True)
    ticket_type: Mapped[str | None] = mapped_column(String(50), nullable=True)
    oem_engineer_contact: Mapped[str | None] = mapped_column(String(500), nullable=True)
    tac_response_summary: Mapped[str | None] = mapped_column(Text, nullable=True)
    tac_resolution: Mapped[str | None] = mapped_column(Text, nullable=True)
    oem_status: Mapped[str | None] = mapped_column(String(50), nullable=True)
    last_checked_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
