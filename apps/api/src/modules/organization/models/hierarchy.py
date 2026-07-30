"""Department, business unit, location, cost/profit center ORM models."""

from datetime import date
from uuid import UUID, uuid4

from sqlalchemy import CheckConstraint, ForeignKey, Integer, Numeric, String, UniqueConstraint
from sqlalchemy.dialects.postgresql import UUID as PG_UUID
from sqlalchemy.orm import Mapped, mapped_column

from database.base import Base
from database.mixins import AuditMixin, CompanyMixin, SoftDeleteMixin, TenantMixin, VersionMixin


class OrgDepartment(Base, AuditMixin, TenantMixin, CompanyMixin, SoftDeleteMixin, VersionMixin):
    __tablename__ = "org_department"
    __table_args__ = (
        UniqueConstraint("branch_id", "department_code", name="uk_org_department_branch_code"),
        CheckConstraint(
            "status IN ('draft','active','inactive')",
            name="ck_org_department_status",
        ),
        {"schema": "organization"},
    )

    id: Mapped[UUID] = mapped_column(PG_UUID(as_uuid=True), primary_key=True, default=uuid4)
    branch_id: Mapped[UUID] = mapped_column(
        PG_UUID(as_uuid=True),
        ForeignKey("organization.org_branch.id", ondelete="RESTRICT"),
        nullable=False,
        index=True,
    )
    department_code: Mapped[str] = mapped_column(String(50), nullable=False)
    department_name: Mapped[str] = mapped_column(String(255), nullable=False)
    parent_department_id: Mapped[UUID | None] = mapped_column(
        PG_UUID(as_uuid=True),
        ForeignKey("organization.org_department.id", ondelete="RESTRICT"),
        nullable=True,
    )
    head_employee_id: Mapped[UUID | None] = mapped_column(PG_UUID(as_uuid=True), nullable=True)
    status: Mapped[str] = mapped_column(String(30), nullable=False, default="draft")


class OrgBusinessUnit(Base, AuditMixin, TenantMixin, CompanyMixin, SoftDeleteMixin, VersionMixin):
    __tablename__ = "org_business_unit"
    __table_args__ = (
        UniqueConstraint(
            "branch_id", "business_unit_code", name="uk_org_business_unit_branch_code"
        ),
        CheckConstraint(
            "status IN ('draft','active','inactive')",
            name="ck_org_business_unit_status",
        ),
        {"schema": "organization"},
    )

    id: Mapped[UUID] = mapped_column(PG_UUID(as_uuid=True), primary_key=True, default=uuid4)
    branch_id: Mapped[UUID] = mapped_column(
        PG_UUID(as_uuid=True),
        ForeignKey("organization.org_branch.id", ondelete="RESTRICT"),
        nullable=False,
        index=True,
    )
    business_unit_code: Mapped[str] = mapped_column(String(50), nullable=False)
    business_unit_name: Mapped[str] = mapped_column(String(255), nullable=False)
    description: Mapped[str | None] = mapped_column(String(500), nullable=True)
    manager_employee_id: Mapped[UUID | None] = mapped_column(PG_UUID(as_uuid=True), nullable=True)
    status: Mapped[str] = mapped_column(String(30), nullable=False, default="draft")


class OrgLocation(Base, AuditMixin, TenantMixin, CompanyMixin, SoftDeleteMixin, VersionMixin):
    __tablename__ = "org_location"
    __table_args__ = (
        UniqueConstraint("branch_id", "location_code", name="uk_org_location_branch_code"),
        CheckConstraint(
            "status IN ('draft','active','inactive')",
            name="ck_org_location_status",
        ),
        {"schema": "organization"},
    )

    id: Mapped[UUID] = mapped_column(PG_UUID(as_uuid=True), primary_key=True, default=uuid4)
    branch_id: Mapped[UUID] = mapped_column(
        PG_UUID(as_uuid=True),
        ForeignKey("organization.org_branch.id", ondelete="RESTRICT"),
        nullable=False,
        index=True,
    )
    location_code: Mapped[str] = mapped_column(String(50), nullable=False)
    location_name: Mapped[str] = mapped_column(String(255), nullable=False)
    location_type: Mapped[str] = mapped_column(String(30), nullable=False, default="office")
    latitude: Mapped[float | None] = mapped_column(Numeric(10, 7), nullable=True)
    longitude: Mapped[float | None] = mapped_column(Numeric(10, 7), nullable=True)
    geofence_radius_meters: Mapped[int | None] = mapped_column(Integer, nullable=True)
    address_line1: Mapped[str | None] = mapped_column(String(255), nullable=True)
    address_line2: Mapped[str | None] = mapped_column(String(255), nullable=True)
    city: Mapped[str | None] = mapped_column(String(100), nullable=True)
    state_code: Mapped[str | None] = mapped_column(String(20), nullable=True)
    postal_code: Mapped[str | None] = mapped_column(String(20), nullable=True)
    country_code: Mapped[str | None] = mapped_column(String(3), nullable=True)
    status: Mapped[str] = mapped_column(String(30), nullable=False, default="draft")


class OrgCostCenter(Base, AuditMixin, TenantMixin, CompanyMixin, SoftDeleteMixin, VersionMixin):
    __tablename__ = "org_cost_center"
    __table_args__ = (
        UniqueConstraint(
            "company_id", "cost_center_code", name="uk_org_cost_center_company_code"
        ),
        CheckConstraint(
            "status IN ('draft','active','inactive')",
            name="ck_org_cost_center_status",
        ),
        CheckConstraint(
            "valid_to IS NULL OR valid_to >= valid_from",
            name="ck_org_cost_center_dates",
        ),
        {"schema": "organization"},
    )

    id: Mapped[UUID] = mapped_column(PG_UUID(as_uuid=True), primary_key=True, default=uuid4)
    branch_id: Mapped[UUID | None] = mapped_column(
        PG_UUID(as_uuid=True),
        ForeignKey("organization.org_branch.id", ondelete="RESTRICT"),
        nullable=True,
    )
    department_id: Mapped[UUID | None] = mapped_column(
        PG_UUID(as_uuid=True),
        ForeignKey("organization.org_department.id", ondelete="RESTRICT"),
        nullable=True,
    )
    cost_center_code: Mapped[str] = mapped_column(String(50), nullable=False)
    cost_center_name: Mapped[str] = mapped_column(String(255), nullable=False)
    valid_from: Mapped[date] = mapped_column(nullable=False)
    valid_to: Mapped[date | None] = mapped_column(nullable=True)
    status: Mapped[str] = mapped_column(String(30), nullable=False, default="draft")


class OrgProfitCenter(Base, AuditMixin, TenantMixin, CompanyMixin, SoftDeleteMixin, VersionMixin):
    __tablename__ = "org_profit_center"
    __table_args__ = (
        UniqueConstraint(
            "company_id", "profit_center_code", name="uk_org_profit_center_company_code"
        ),
        CheckConstraint(
            "status IN ('draft','active','inactive')",
            name="ck_org_profit_center_status",
        ),
        CheckConstraint(
            "valid_to IS NULL OR valid_to >= valid_from",
            name="ck_org_profit_center_dates",
        ),
        {"schema": "organization"},
    )

    id: Mapped[UUID] = mapped_column(PG_UUID(as_uuid=True), primary_key=True, default=uuid4)
    branch_id: Mapped[UUID | None] = mapped_column(
        PG_UUID(as_uuid=True),
        ForeignKey("organization.org_branch.id", ondelete="RESTRICT"),
        nullable=True,
    )
    department_id: Mapped[UUID | None] = mapped_column(
        PG_UUID(as_uuid=True),
        ForeignKey("organization.org_department.id", ondelete="RESTRICT"),
        nullable=True,
    )
    profit_center_code: Mapped[str] = mapped_column(String(50), nullable=False)
    profit_center_name: Mapped[str] = mapped_column(String(255), nullable=False)
    valid_from: Mapped[date] = mapped_column(nullable=False)
    valid_to: Mapped[date | None] = mapped_column(nullable=True)
    status: Mapped[str] = mapped_column(String(30), nullable=False, default="draft")
