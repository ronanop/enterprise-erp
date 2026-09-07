"""Per-user HR sidebar visibility for assigned HR Admins."""

from uuid import UUID, uuid4

from sqlalchemy import UniqueConstraint
from sqlalchemy.dialects.postgresql import JSONB
from sqlalchemy.dialects.postgresql import UUID as PG_UUID
from sqlalchemy.orm import Mapped, mapped_column

from database.base import Base
from database.mixins import AuditMixin, SoftDeleteMixin, TenantMixin, VersionMixin


class HrAdminNavAccess(Base, AuditMixin, TenantMixin, SoftDeleteMixin, VersionMixin):
    __tablename__ = "hr_admin_nav_access"
    __table_args__ = (
        UniqueConstraint("tenant_id", "user_id", name="uk_hr_admin_nav_user"),
        {"schema": "hr"},
    )

    id: Mapped[UUID] = mapped_column(PG_UUID(as_uuid=True), primary_key=True, default=uuid4)
    user_id: Mapped[UUID] = mapped_column(PG_UUID(as_uuid=True), nullable=False, index=True)
    nav_keys: Mapped[list] = mapped_column(JSONB, nullable=False, default=list)
