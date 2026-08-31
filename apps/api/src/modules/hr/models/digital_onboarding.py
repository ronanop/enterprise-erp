"""HR digital onboarding cases (candidate portal + invitation tokens)."""

from datetime import datetime
from uuid import UUID, uuid4

from sqlalchemy import DateTime, String, Text, UniqueConstraint
from sqlalchemy.dialects.postgresql import JSONB
from sqlalchemy.dialects.postgresql import UUID as PG_UUID
from sqlalchemy.orm import Mapped, mapped_column

from database.base import Base
from database.mixins import AuditMixin, SoftDeleteMixin, TenantMixin, VersionMixin


class HrDigitalOnboarding(Base, AuditMixin, TenantMixin, SoftDeleteMixin, VersionMixin):
    """Persists enterprise digital-onboarding cases so portal links work cross-browser."""

    __tablename__ = "hr_digital_onboarding"
    __table_args__ = (
        UniqueConstraint("invitation_token", name="uk_hr_dig_onb_token"),
        UniqueConstraint("tenant_id", "case_code", name="uk_hr_dig_onb_tenant_code"),
        {"schema": "hr"},
    )

    id: Mapped[UUID] = mapped_column(PG_UUID(as_uuid=True), primary_key=True, default=uuid4)
    case_code: Mapped[str] = mapped_column(String(40), nullable=False, index=True)
    invitation_token: Mapped[str] = mapped_column(String(64), nullable=False, index=True)
    invitation_expires_at: Mapped[datetime | None] = mapped_column(
        DateTime(timezone=True), nullable=True
    )
    status: Mapped[str] = mapped_column(String(40), nullable=False, default="draft", index=True)
    candidate_name: Mapped[str] = mapped_column(String(200), nullable=False, default="")
    candidate_email: Mapped[str] = mapped_column(String(200), nullable=False, default="")
    case_json: Mapped[dict] = mapped_column(JSONB, nullable=False, default=dict)
    terms_accepted_at: Mapped[datetime | None] = mapped_column(
        DateTime(timezone=True), nullable=True
    )
    terms_version: Mapped[str | None] = mapped_column(String(40), nullable=True)
    terms_accepted_ip: Mapped[str | None] = mapped_column(String(64), nullable=True)
    notes: Mapped[str | None] = mapped_column(Text, nullable=True)
