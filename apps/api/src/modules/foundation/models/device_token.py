"""Push notification device token ORM."""

from uuid import UUID, uuid4

from sqlalchemy import Boolean, CheckConstraint, String, UniqueConstraint
from sqlalchemy.dialects.postgresql import UUID as PG_UUID
from sqlalchemy.orm import Mapped, mapped_column

from database.base import Base
from database.mixins import AuditMixin, SoftDeleteMixin, TenantMixin


class NtfDeviceToken(Base, AuditMixin, SoftDeleteMixin, TenantMixin):
    __tablename__ = "ntf_device_token"
    __table_args__ = (
        UniqueConstraint("tenant_id", "user_id", "token", name="uk_ntf_device_token"),
        CheckConstraint("platform IN ('web','android','ios')", name="ck_ntf_device_platform"),
        {"schema": "foundation"},
    )

    id: Mapped[UUID] = mapped_column(PG_UUID(as_uuid=True), primary_key=True, default=uuid4)
    user_id: Mapped[UUID] = mapped_column(PG_UUID(as_uuid=True), nullable=False, index=True)
    token: Mapped[str] = mapped_column(String(512), nullable=False)
    platform: Mapped[str] = mapped_column(String(30), nullable=False, default="web")
    is_active: Mapped[bool] = mapped_column(Boolean, nullable=False, default=True)
