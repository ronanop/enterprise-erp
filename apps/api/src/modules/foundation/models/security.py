"""Security ORM models."""

from datetime import datetime
from uuid import UUID, uuid4

from sqlalchemy import Boolean, DateTime, ForeignKey, Integer, String, Text, UniqueConstraint
from sqlalchemy.dialects.postgresql import UUID as PG_UUID
from sqlalchemy.orm import Mapped, mapped_column, relationship

from database.base import Base
from database.mixins import AuditMixin, SoftDeleteMixin, TenantMixin, VersionMixin


class SecTenant(Base, AuditMixin, SoftDeleteMixin, VersionMixin):
    __tablename__ = "sec_tenant"
    __table_args__ = {"schema": "foundation"}

    id: Mapped[UUID] = mapped_column(PG_UUID(as_uuid=True), primary_key=True, default=uuid4)
    tenant_code: Mapped[str] = mapped_column(String(50), unique=True, nullable=False)
    tenant_name: Mapped[str] = mapped_column(String(255), nullable=False)
    status: Mapped[str] = mapped_column(String(30), nullable=False, default="active")
    subscription_plan: Mapped[str | None] = mapped_column(String(50), nullable=True)
    max_companies: Mapped[int | None] = mapped_column(Integer, nullable=True)
    max_users: Mapped[int | None] = mapped_column(Integer, nullable=True)
    timezone: Mapped[str] = mapped_column(String(50), nullable=False, default="UTC")
    locale: Mapped[str] = mapped_column(String(10), nullable=False, default="en")

    users: Mapped[list["SecUser"]] = relationship(back_populates="tenant")
    roles: Mapped[list["SecRole"]] = relationship(back_populates="tenant")


class SecUser(Base, AuditMixin, SoftDeleteMixin, TenantMixin, VersionMixin):
    __tablename__ = "sec_user"
    __table_args__ = (
        UniqueConstraint("tenant_id", "email", name="uk_sec_user_tenant_email"),
        {"schema": "foundation"},
    )

    id: Mapped[UUID] = mapped_column(PG_UUID(as_uuid=True), primary_key=True, default=uuid4)
    email: Mapped[str] = mapped_column(String(255), nullable=False)
    password_hash: Mapped[str] = mapped_column(String(255), nullable=False)
    display_name: Mapped[str] = mapped_column(String(255), nullable=False)
    user_type: Mapped[str] = mapped_column(String(30), nullable=False, default="employee")
    status: Mapped[str] = mapped_column(String(30), nullable=False, default="active")
    mfa_enabled: Mapped[bool] = mapped_column(Boolean, default=False, server_default="false")
    mfa_secret_encrypted: Mapped[str | None] = mapped_column(Text, nullable=True)
    last_login_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    failed_login_count: Mapped[int] = mapped_column(Integer, default=0, server_default="0")
    locked_until: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    employee_id: Mapped[UUID | None] = mapped_column(PG_UUID(as_uuid=True), nullable=True)

    tenant: Mapped["SecTenant"] = relationship(back_populates="users")
    user_roles: Mapped[list["SecUserRole"]] = relationship(back_populates="user")
    sessions: Mapped[list["SecSession"]] = relationship(back_populates="user")
    refresh_tokens: Mapped[list["SecRefreshToken"]] = relationship(back_populates="user")
    org_scopes: Mapped[list["SecUserOrgScope"]] = relationship(back_populates="user")
    user_modules: Mapped[list["SecUserModule"]] = relationship(back_populates="user")


class SecUserModule(Base, TenantMixin):
    __tablename__ = "sec_user_module"
    __table_args__ = (
        UniqueConstraint("user_id", "module_key", name="uk_sec_user_module"),
        {"schema": "foundation"},
    )

    id: Mapped[UUID] = mapped_column(PG_UUID(as_uuid=True), primary_key=True, default=uuid4)
    user_id: Mapped[UUID] = mapped_column(
        PG_UUID(as_uuid=True), ForeignKey("foundation.sec_user.id"), nullable=False
    )
    module_key: Mapped[str] = mapped_column(String(50), nullable=False)
    role: Mapped[str] = mapped_column(String(20), nullable=False, default="member")
    assigned_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False)
    assigned_by: Mapped[UUID | None] = mapped_column(PG_UUID(as_uuid=True), nullable=True)

    user: Mapped["SecUser"] = relationship(back_populates="user_modules")


class SecRole(Base, AuditMixin, SoftDeleteMixin, TenantMixin, VersionMixin):
    __tablename__ = "sec_role"
    __table_args__ = (
        UniqueConstraint("tenant_id", "role_code", name="uk_sec_role_tenant_code"),
        {"schema": "foundation"},
    )

    id: Mapped[UUID] = mapped_column(PG_UUID(as_uuid=True), primary_key=True, default=uuid4)
    role_code: Mapped[str] = mapped_column(String(100), nullable=False)
    role_name: Mapped[str] = mapped_column(String(255), nullable=False)
    description: Mapped[str | None] = mapped_column(Text, nullable=True)
    is_system_role: Mapped[bool] = mapped_column(Boolean, default=False, server_default="false")
    status: Mapped[str] = mapped_column(String(30), nullable=False, default="active")

    tenant: Mapped["SecTenant"] = relationship()
    user_roles: Mapped[list["SecUserRole"]] = relationship(back_populates="role")
    role_permissions: Mapped[list["SecRolePermission"]] = relationship(back_populates="role")


class SecPermission(Base):
    __tablename__ = "sec_permission"
    __table_args__ = {"schema": "foundation"}

    id: Mapped[UUID] = mapped_column(PG_UUID(as_uuid=True), primary_key=True, default=uuid4)
    permission_code: Mapped[str] = mapped_column(String(150), unique=True, nullable=False)
    resource: Mapped[str] = mapped_column(String(100), nullable=False)
    action: Mapped[str] = mapped_column(String(50), nullable=False)
    description: Mapped[str | None] = mapped_column(Text, nullable=True)
    module: Mapped[str] = mapped_column(String(50), nullable=False)
    is_active: Mapped[bool] = mapped_column(Boolean, default=True, server_default="true")
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False)
    created_by: Mapped[UUID | None] = mapped_column(PG_UUID(as_uuid=True), nullable=True)

    role_permissions: Mapped[list["SecRolePermission"]] = relationship(back_populates="permission")


class SecUserRole(Base, TenantMixin):
    __tablename__ = "sec_user_role"
    __table_args__ = (
        UniqueConstraint("user_id", "role_id", name="uk_sec_user_role"),
        {"schema": "foundation"},
    )

    id: Mapped[UUID] = mapped_column(PG_UUID(as_uuid=True), primary_key=True, default=uuid4)
    user_id: Mapped[UUID] = mapped_column(
        PG_UUID(as_uuid=True), ForeignKey("foundation.sec_user.id"), nullable=False
    )
    role_id: Mapped[UUID] = mapped_column(
        PG_UUID(as_uuid=True), ForeignKey("foundation.sec_role.id"), nullable=False
    )
    assigned_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False)
    assigned_by: Mapped[UUID | None] = mapped_column(PG_UUID(as_uuid=True), nullable=True)
    expires_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)

    user: Mapped["SecUser"] = relationship(back_populates="user_roles")
    role: Mapped["SecRole"] = relationship(back_populates="user_roles")


class SecRolePermission(Base, TenantMixin):
    __tablename__ = "sec_role_permission"
    __table_args__ = (
        UniqueConstraint("role_id", "permission_id", name="uk_sec_role_permission"),
        {"schema": "foundation"},
    )

    id: Mapped[UUID] = mapped_column(PG_UUID(as_uuid=True), primary_key=True, default=uuid4)
    role_id: Mapped[UUID] = mapped_column(
        PG_UUID(as_uuid=True), ForeignKey("foundation.sec_role.id"), nullable=False
    )
    permission_id: Mapped[UUID] = mapped_column(
        PG_UUID(as_uuid=True), ForeignKey("foundation.sec_permission.id"), nullable=False
    )
    granted_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False)
    granted_by: Mapped[UUID | None] = mapped_column(PG_UUID(as_uuid=True), nullable=True)

    role: Mapped["SecRole"] = relationship(back_populates="role_permissions")
    permission: Mapped["SecPermission"] = relationship(back_populates="role_permissions")


class SecSession(Base, TenantMixin):
    __tablename__ = "sec_session"
    __table_args__ = {"schema": "foundation"}

    id: Mapped[UUID] = mapped_column(PG_UUID(as_uuid=True), primary_key=True, default=uuid4)
    user_id: Mapped[UUID] = mapped_column(
        PG_UUID(as_uuid=True), ForeignKey("foundation.sec_user.id"), nullable=False
    )
    session_token_hash: Mapped[str] = mapped_column(String(255), nullable=False)
    ip_address: Mapped[str | None] = mapped_column(String(45), nullable=True)
    user_agent: Mapped[str | None] = mapped_column(Text, nullable=True)
    issued_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False)
    expires_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False)
    revoked_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    revoked_by: Mapped[UUID | None] = mapped_column(PG_UUID(as_uuid=True), nullable=True)

    user: Mapped["SecUser"] = relationship(back_populates="sessions")


class SecRefreshToken(Base, TenantMixin):
    __tablename__ = "sec_refresh_token"
    __table_args__ = {"schema": "foundation"}

    id: Mapped[UUID] = mapped_column(PG_UUID(as_uuid=True), primary_key=True, default=uuid4)
    user_id: Mapped[UUID] = mapped_column(
        PG_UUID(as_uuid=True), ForeignKey("foundation.sec_user.id"), nullable=False
    )
    session_id: Mapped[UUID] = mapped_column(
        PG_UUID(as_uuid=True), ForeignKey("foundation.sec_session.id"), nullable=False
    )
    token_hash: Mapped[str] = mapped_column(String(255), nullable=False)
    issued_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False)
    expires_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False)
    revoked_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    replaced_by: Mapped[UUID | None] = mapped_column(PG_UUID(as_uuid=True), nullable=True)

    user: Mapped["SecUser"] = relationship(back_populates="refresh_tokens")


class SecUserOrgScope(Base, TenantMixin):
    __tablename__ = "sec_user_org_scope"
    __table_args__ = (
        UniqueConstraint("user_id", "company_id", "branch_id", name="uk_sec_user_org_scope"),
        {"schema": "foundation"},
    )

    id: Mapped[UUID] = mapped_column(PG_UUID(as_uuid=True), primary_key=True, default=uuid4)
    user_id: Mapped[UUID] = mapped_column(
        PG_UUID(as_uuid=True), ForeignKey("foundation.sec_user.id"), nullable=False
    )
    company_id: Mapped[UUID] = mapped_column(PG_UUID(as_uuid=True), nullable=False)
    branch_id: Mapped[UUID | None] = mapped_column(PG_UUID(as_uuid=True), nullable=True)
    department_id: Mapped[UUID | None] = mapped_column(PG_UUID(as_uuid=True), nullable=True)
    is_default: Mapped[bool] = mapped_column(Boolean, default=False, server_default="false")
    assigned_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False)
    assigned_by: Mapped[UUID | None] = mapped_column(PG_UUID(as_uuid=True), nullable=True)

    user: Mapped["SecUser"] = relationship(back_populates="org_scopes")
