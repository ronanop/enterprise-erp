"""Cached HRMS employee profile for ERP user directory."""

from datetime import datetime
from uuid import UUID, uuid4

from sqlalchemy import Boolean, DateTime, Float, ForeignKey, String, Text, UniqueConstraint, func
from sqlalchemy.dialects.postgresql import JSONB
from sqlalchemy.dialects.postgresql import UUID as PG_UUID
from sqlalchemy.orm import Mapped, mapped_column

from database.base import Base
from database.mixins import AuditMixin, SoftDeleteMixin, TenantMixin, VersionMixin


class HrmsUserProfile(Base, AuditMixin, SoftDeleteMixin, TenantMixin, VersionMixin):
    """Snapshot of remote HRMS employee fields linked to an ERP login."""

    __tablename__ = "hrms_user_profile"
    __table_args__ = (
        UniqueConstraint("tenant_id", "user_id", name="uk_hrms_user_profile_tenant_user"),
        {"schema": "foundation"},
    )

    id: Mapped[UUID] = mapped_column(PG_UUID(as_uuid=True), primary_key=True, default=uuid4)
    user_id: Mapped[UUID] = mapped_column(
        PG_UUID(as_uuid=True),
        ForeignKey("foundation.sec_user.id", ondelete="RESTRICT"),
        nullable=False,
        index=True,
    )
    employee_id: Mapped[UUID | None] = mapped_column(
        PG_UUID(as_uuid=True),
        ForeignKey("master.master_employee.id", ondelete="RESTRICT"),
        nullable=True,
        index=True,
    )
    remote_id: Mapped[str | None] = mapped_column(String(64), nullable=True)
    employee_code: Mapped[str] = mapped_column(String(50), nullable=False, index=True)

    display_name: Mapped[str] = mapped_column(String(200), nullable=False, default="")
    first_name: Mapped[str] = mapped_column(String(100), nullable=False, default="")
    last_name: Mapped[str] = mapped_column(String(100), nullable=False, default="")
    email: Mapped[str] = mapped_column(String(255), nullable=False, default="")
    mobile: Mapped[str] = mapped_column(String(30), nullable=False, default="")
    designation: Mapped[str] = mapped_column(String(100), nullable=False, default="")
    department: Mapped[str] = mapped_column(String(150), nullable=False, default="")
    manager: Mapped[str] = mapped_column(String(200), nullable=False, default="")
    manager_code: Mapped[str] = mapped_column(String(50), nullable=False, default="")
    branch: Mapped[str] = mapped_column(String(150), nullable=False, default="")
    company: Mapped[str] = mapped_column(String(200), nullable=False, default="")
    status: Mapped[str] = mapped_column(String(30), nullable=False, default="active")
    date_of_joining: Mapped[str | None] = mapped_column(String(20), nullable=True)
    date_of_leaving: Mapped[str | None] = mapped_column(String(20), nullable=True)
    gender: Mapped[str | None] = mapped_column(String(30), nullable=True)
    date_of_birth: Mapped[str | None] = mapped_column(String(20), nullable=True)
    employment_type: Mapped[str | None] = mapped_column(String(50), nullable=True)
    work_location: Mapped[str | None] = mapped_column(String(150), nullable=True)
    is_manager: Mapped[bool] = mapped_column(
        Boolean, nullable=False, default=False, server_default="false"
    )

    leave_balances: Mapped[list | dict | None] = mapped_column(JSONB, nullable=True)
    leave_balance_total: Mapped[float] = mapped_column(Float, nullable=False, default=0, server_default="0")
    leave_used_total: Mapped[float] = mapped_column(Float, nullable=False, default=0, server_default="0")

    raw_json: Mapped[dict | None] = mapped_column(JSONB, nullable=True)
    profile_fetched_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    leave_fetched_at: Mapped[datetime | None] = mapped_column(
        DateTime(timezone=True),
        nullable=True,
        server_default=func.now(),
    )
    notes: Mapped[str | None] = mapped_column(Text, nullable=True)
