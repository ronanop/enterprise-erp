"""Dashboard ORM per ERD_23 section 5.4."""

from uuid import UUID, uuid4

from sqlalchemy import Boolean, CheckConstraint, ForeignKey, Index, String, UniqueConstraint
from sqlalchemy.dialects.postgresql import JSONB
from sqlalchemy.dialects.postgresql import UUID as PG_UUID
from sqlalchemy.orm import Mapped, mapped_column

from database.base import Base
from modules.portal.models.mixins import PtRowMixin


class PtDashboard(Base, *PtRowMixin):
    __tablename__ = "pt_dashboard"
    __table_args__ = (
        UniqueConstraint("company_id", "dashboard_number", name="uk_pt_dashboard_number"),
        CheckConstraint(
            "status IN ('draft','active','archived')",
            name="ck_pt_dashboard_status",
        ),
        Index("ix_pt_dashboard_tenant_co_status", "tenant_id", "company_id", "status"),
        {"schema": "portal"},
    )

    id: Mapped[UUID] = mapped_column(PG_UUID(as_uuid=True), primary_key=True, default=uuid4)
    dashboard_number: Mapped[str] = mapped_column(String(50), nullable=False)

    portal_account_id: Mapped[UUID] = mapped_column(
        PG_UUID(as_uuid=True),
        ForeignKey(
            "portal.pt_portal_account.id",
            ondelete="RESTRICT",
        ),
        nullable=False,
        index=True,
    )
    dashboard_code: Mapped[str] = mapped_column(String(50), nullable=False)
    dashboard_name: Mapped[str] = mapped_column(String(255), nullable=False)
    layout_json: Mapped[dict | None] = mapped_column(JSONB, nullable=True)
    is_default: Mapped[bool] = mapped_column(Boolean, nullable=False, default=False)
    status: Mapped[str] = mapped_column(String(30), nullable=False, default="draft", index=True)
