"""Configurable default My Jobs assignees per CRM approval step."""

from uuid import UUID, uuid4

from sqlalchemy import String, UniqueConstraint
from sqlalchemy.dialects.postgresql import UUID as PG_UUID
from sqlalchemy.orm import Mapped, mapped_column

from database.base import Base
from database.mixins import AuditMixin, SoftDeleteMixin, TenantMixin, VersionMixin


class CrmApprovalStepOwner(Base, AuditMixin, TenantMixin, SoftDeleteMixin, VersionMixin):
    __tablename__ = "crm_approval_step_owner"
    __table_args__ = (
        UniqueConstraint(
            "tenant_id",
            "step_key",
            "user_id",
            name="uk_crm_approval_step_owner_tenant_step_user",
        ),
        {"schema": "crm"},
    )

    id: Mapped[UUID] = mapped_column(PG_UUID(as_uuid=True), primary_key=True, default=uuid4)
    step_key: Mapped[str] = mapped_column(String(80), nullable=False, index=True)
    user_id: Mapped[UUID] = mapped_column(PG_UUID(as_uuid=True), nullable=False, index=True)
