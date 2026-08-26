"""Branch ORM model."""

from uuid import UUID, uuid4

from sqlalchemy import CheckConstraint, String, UniqueConstraint
from sqlalchemy.dialects.postgresql import UUID as PG_UUID
from sqlalchemy.orm import Mapped, mapped_column

from database.base import Base
from database.mixins import AuditMixin, CompanyMixin, SoftDeleteMixin, TenantMixin, VersionMixin


class OrgBranch(Base, AuditMixin, TenantMixin, CompanyMixin, SoftDeleteMixin, VersionMixin):
    __tablename__ = "org_branch"
    __table_args__ = (
        UniqueConstraint("company_id", "branch_code", name="uk_org_branch_company_code"),
        CheckConstraint(
            "status IN ('draft','active','inactive')",
            name="ck_org_branch_status",
        ),
        {"schema": "organization"},
    )

    id: Mapped[UUID] = mapped_column(PG_UUID(as_uuid=True), primary_key=True, default=uuid4)
    branch_code: Mapped[str] = mapped_column(String(50), nullable=False)
    branch_name: Mapped[str] = mapped_column(String(255), nullable=False)
    branch_type: Mapped[str] = mapped_column(String(30), nullable=False, default="regional")
    address_line1: Mapped[str | None] = mapped_column(String(255), nullable=True)
    address_line2: Mapped[str | None] = mapped_column(String(255), nullable=True)
    city: Mapped[str | None] = mapped_column(String(100), nullable=True)
    state_code: Mapped[str | None] = mapped_column(String(20), nullable=True)
    postal_code: Mapped[str | None] = mapped_column(String(20), nullable=True)
    country_code: Mapped[str | None] = mapped_column(String(3), nullable=True)
    phone: Mapped[str | None] = mapped_column(String(30), nullable=True)
    email: Mapped[str | None] = mapped_column(String(255), nullable=True)
    head_employee_id: Mapped[UUID | None] = mapped_column(PG_UUID(as_uuid=True), nullable=True)
    status: Mapped[str] = mapped_column(String(30), nullable=False, default="draft")
