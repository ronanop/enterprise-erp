"""Multiple field engineers assigned to a service request ticket."""

from datetime import date, datetime
from uuid import UUID, uuid4

from sqlalchemy import Boolean, CheckConstraint, Date, DateTime, ForeignKey, String, Text
from sqlalchemy.dialects.postgresql import UUID as PG_UUID
from sqlalchemy.orm import Mapped, mapped_column

from database.base import Base
from database.mixins import AuditMixin, CompanyMixin, SoftDeleteMixin, TenantMixin, VersionMixin


class SvcTicketFieldEngineer(Base, AuditMixin, TenantMixin, CompanyMixin, SoftDeleteMixin, VersionMixin):
    __tablename__ = "svc_ticket_field_engineer"
    __table_args__ = (
        CheckConstraint("status IN ('assigned','solved')", name="ck_svc_ticket_fe_status"),
        {"schema": "service"},
    )

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
        index=True,
    )
    engineer_name: Mapped[str] = mapped_column(String(255), nullable=False)
    engineer_contact: Mapped[str | None] = mapped_column(String(50), nullable=True)
    engineer_email: Mapped[str] = mapped_column(String(255), nullable=False, index=True)
    assigned_date: Mapped[date | None] = mapped_column(Date, nullable=True)
    solution_summary: Mapped[str | None] = mapped_column(Text, nullable=True)
    status: Mapped[str] = mapped_column(String(30), nullable=False, default="assigned")
    solved_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)

    # Instructions + which ticket sections the FE portal should show
    work_brief: Mapped[str | None] = mapped_column(Text, nullable=True)
    show_issue: Mapped[bool] = mapped_column(Boolean, nullable=False, default=True)
    show_customer: Mapped[bool] = mapped_column(Boolean, nullable=False, default=True)
    show_site: Mapped[bool] = mapped_column(Boolean, nullable=False, default=True)
    show_asset: Mapped[bool] = mapped_column(Boolean, nullable=False, default=True)
    show_circuit: Mapped[bool] = mapped_column(Boolean, nullable=False, default=True)
