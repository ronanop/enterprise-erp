"""Dashboard ORM per ERD_20 section 6.1."""

from datetime import datetime
from uuid import UUID, uuid4

from sqlalchemy import (
    Boolean,
    CheckConstraint,
    DateTime,
    ForeignKey,
    Index,
    String,
    UniqueConstraint,
)
from sqlalchemy.dialects.postgresql import JSONB
from sqlalchemy.dialects.postgresql import UUID as PG_UUID
from sqlalchemy.orm import Mapped, mapped_column

from database.base import Base
from modules.analytics.models.mixins import BiRowMixin


class BiDashboard(Base, *BiRowMixin):
    __tablename__ = "bi_dashboard"
    __table_args__ = (
        UniqueConstraint("company_id", "dashboard_number", name="uk_bi_dashboard_number"),
        UniqueConstraint("company_id", "dashboard_code", name="uk_bi_dashboard_code"),
        CheckConstraint(
            "dashboard_type IN ('executive','operational','self_service')",
            name="ck_bi_dashboard_type",
        ),
        CheckConstraint(
            "status IN ('draft','submitted','approved','published','archived','cancelled')",
            name="ck_bi_dashboard_status",
        ),
        Index("ix_bi_dashboard_tenant_co_status", "tenant_id", "company_id", "status"),
        {"schema": "analytics"},
    )

    id: Mapped[UUID] = mapped_column(PG_UUID(as_uuid=True), primary_key=True, default=uuid4)

    branch_id: Mapped[UUID | None] = mapped_column(
        PG_UUID(as_uuid=True),
        ForeignKey("organization.org_branch.id", ondelete="RESTRICT"),
        nullable=True,
        index=True,
    )

    dashboard_number: Mapped[str] = mapped_column(String(50), nullable=False)
    dashboard_code: Mapped[str] = mapped_column(String(50), nullable=False)
    dashboard_name: Mapped[str] = mapped_column(String(255), nullable=False)
    dashboard_type: Mapped[str] = mapped_column(String(40), nullable=False)
    audience_role: Mapped[str | None] = mapped_column(String(40), nullable=True)

    owner_employee_id: Mapped[UUID] = mapped_column(
        PG_UUID(as_uuid=True),
        ForeignKey("master.master_employee.id", ondelete="RESTRICT"),
        nullable=False,
        index=True,
    )

    department_id: Mapped[UUID | None] = mapped_column(
        PG_UUID(as_uuid=True),
        ForeignKey("organization.org_department.id", ondelete="RESTRICT"),
        nullable=True,
        index=True,
    )
    layout_json: Mapped[dict | None] = mapped_column(JSONB, nullable=True)
    is_default: Mapped[bool] = mapped_column(Boolean, nullable=False, default=False)
    published_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    status: Mapped[str] = mapped_column(String(30), nullable=False, default="draft", index=True)

    workflow_status: Mapped[str | None] = mapped_column(String(30), nullable=True)
    workflow_instance_id: Mapped[UUID | None] = mapped_column(
        PG_UUID(as_uuid=True),
        ForeignKey("foundation.wf_instance.id", ondelete="SET NULL"),
        nullable=True,
    )

