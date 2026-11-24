"""Tenant-wide CRM customization config (ERP-admin Settings)."""

from uuid import UUID, uuid4

from sqlalchemy import Integer, UniqueConstraint
from sqlalchemy.dialects.postgresql import JSONB, UUID as PG_UUID
from sqlalchemy.orm import Mapped, mapped_column

from database.base import Base
from database.mixins import AuditMixin, SoftDeleteMixin, TenantMixin, VersionMixin


class CrmTenantSettings(Base, AuditMixin, TenantMixin, SoftDeleteMixin, VersionMixin):
    """One overlay config row per tenant; missing row means stock CRM defaults."""

    __tablename__ = "crm_tenant_settings"
    __table_args__ = (
        UniqueConstraint("tenant_id", name="uk_crm_tenant_settings_tenant"),
        {"schema": "crm"},
    )

    id: Mapped[UUID] = mapped_column(PG_UUID(as_uuid=True), primary_key=True, default=uuid4)
    config_version: Mapped[int] = mapped_column(Integer, nullable=False, default=1, server_default="1")
    config: Mapped[dict] = mapped_column(JSONB, nullable=False, default=dict)
