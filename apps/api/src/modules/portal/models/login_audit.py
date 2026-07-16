"""Login audit ORM per ERD_23 section 5.19."""

from datetime import datetime
from uuid import UUID, uuid4

from sqlalchemy import CheckConstraint, ForeignKey, Index, String, UniqueConstraint
from sqlalchemy.dialects.postgresql import UUID as PG_UUID
from sqlalchemy.orm import Mapped, mapped_column

from database.base import Base
from modules.portal.models.mixins import PtRowMixin


class PtLoginAudit(Base, *PtRowMixin):
    __tablename__ = "pt_login_audit"
    __table_args__ = (
        UniqueConstraint("company_id", "audit_number", name="uk_pt_login_audit_number"),
        CheckConstraint(
            "event_type IN ('login_success','login_failure','logout','lockout','password_reset')",
            name="ck_pt_login_audit_event_type",
        ),
        CheckConstraint(
            "status = 'recorded'",
            name="ck_pt_login_audit_status",
        ),
        Index("ix_pt_login_audit_tenant_co_status", "tenant_id", "company_id", "status"),
        {"schema": "portal"},
    )

    id: Mapped[UUID] = mapped_column(PG_UUID(as_uuid=True), primary_key=True, default=uuid4)
    audit_number: Mapped[str] = mapped_column(String(50), nullable=False)

    portal_account_id: Mapped[UUID | None] = mapped_column(
        PG_UUID(as_uuid=True),
        ForeignKey(
            "portal.pt_portal_account.id",
            ondelete="SET NULL",
        ),
        nullable=True,
        index=True,
    )

    device_id: Mapped[UUID | None] = mapped_column(
        PG_UUID(as_uuid=True),
        ForeignKey(
            "portal.pt_device.id",
            ondelete="SET NULL",
        ),
        nullable=True,
        index=True,
    )
    event_type: Mapped[str] = mapped_column(String(40), nullable=False)
    occurred_at: Mapped[datetime | None] = mapped_column(nullable=True)
    ip_address: Mapped[str | None] = mapped_column(String(64), nullable=True)
    user_agent: Mapped[str | None] = mapped_column(String(512), nullable=True)
    status: Mapped[str] = mapped_column(String(30), nullable=False, default="recorded", index=True)
