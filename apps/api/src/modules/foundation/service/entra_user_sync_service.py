"""Sync ERP users from Microsoft Entra ID (Microsoft 365 directory)."""

from __future__ import annotations

import secrets
from dataclasses import dataclass
from uuid import UUID

from sqlalchemy import func, select
from sqlalchemy.orm import Session

from core.config import settings
from core.exceptions import AppException, ConflictException
from modules.foundation.adapters.graph_directory_adapter import (
    GraphDirectoryAdapter,
    GraphDirectoryUser,
)
from modules.foundation.domain.value_objects import TenantContext
from modules.foundation.models.security import SecRole, SecUser, SecUserRole
from modules.foundation.service.org_context_service import OrgContextService
from modules.foundation.service.user_employee_link_service import UserEmployeeLinkService
from modules.foundation.service.user_service import UserService


@dataclass(frozen=True)
class M365UserSyncResult:
    domain: str
    directory_count: int
    created: int
    updated: int


class EntraUserSyncService:
    """Provision tenant users from Microsoft 365 for the configured email domain."""

    def __init__(self, db: Session) -> None:
        self._db = db
        self._users = UserService(db)
        self._org = OrgContextService(db)
        self._user_employee = UserEmployeeLinkService(db)
        self._directory = GraphDirectoryAdapter()

    @staticmethod
    def _sso_placeholder_password() -> str:
        return f"Ms0!{secrets.token_urlsafe(18)}"

    @staticmethod
    def _dedupe_directory_users(rows: list[GraphDirectoryUser]) -> list[GraphDirectoryUser]:
        """Keep one Graph row per email (case-insensitive)."""
        by_email: dict[str, GraphDirectoryUser] = {}
        for row in rows:
            email = row.email.strip().lower()
            if not email or email in by_email:
                continue
            by_email[email] = GraphDirectoryUser(
                email=email,
                display_name=row.display_name,
                external_id=row.external_id,
            )
        return list(by_email.values())

    def _ensure_role(self, tenant_id: UUID, role_code: str, role_name: str) -> SecRole:
        role = self._db.scalar(
            select(SecRole).where(
                SecRole.tenant_id == tenant_id,
                SecRole.role_code == role_code,
                SecRole.is_deleted.is_(False),
            )
        )
        if role:
            return role
        role = SecRole(
            tenant_id=tenant_id,
            role_code=role_code,
            role_name=role_name,
            is_system_role=True,
            status="active",
        )
        self._db.add(role)
        self._db.flush()
        return role

    def _strip_admin_roles(self, user_id: UUID) -> None:
        links = self._db.scalars(
            select(SecUserRole)
            .join(SecRole, SecRole.id == SecUserRole.role_id)
            .where(
                SecUserRole.user_id == user_id,
                SecRole.role_code.in_(("SUPER_ADMIN", "TENANT_ADMIN")),
                SecRole.is_deleted.is_(False),
            )
        ).all()
        for link in links:
            self._db.delete(link)

    def _find_user_by_email(self, tenant_id: UUID, email: str) -> SecUser | None:
        """Match active or soft-deleted users so re-sync never inserts duplicates."""
        return self._db.scalar(
            select(SecUser)
            .where(
                SecUser.tenant_id == tenant_id,
                func.lower(SecUser.email) == email,
            )
            .order_by(SecUser.is_deleted.asc(), SecUser.created_at.asc())
            .limit(1)
        )

    def _upsert_user(
        self,
        *,
        tenant_id: UUID,
        actor_user_id: UUID | None,
        email: str,
        display_name: str,
        is_admin: bool,
    ) -> tuple[SecUser, bool]:
        """Return (user, created). Updates existing rows in place."""
        user = self._find_user_by_email(tenant_id, email)
        if user is None:
            try:
                user_row = self._users.create_user(
                    tenant_id=tenant_id,
                    email=email,
                    password=self._sso_placeholder_password(),
                    display_name=display_name,
                    user_type="super_admin" if is_admin else "employee",
                    created_by=actor_user_id,
                )
            except ConflictException:
                # Race / unique constraint: load existing and update.
                user = self._find_user_by_email(tenant_id, email)
                if user is None:
                    raise
            else:
                user = self._db.scalar(select(SecUser).where(SecUser.id == user_row.id))
                if user is None:
                    raise AppException(f"Failed to load created user for {email}")
                return user, True

        user.email = email
        user.display_name = display_name
        user.status = "active"
        user.is_deleted = False
        user.deleted_at = None
        user.deleted_by = None
        if is_admin:
            user.user_type = "super_admin"
        else:
            user.user_type = "employee"
            self._strip_admin_roles(user.id)
        self._db.flush()
        return user, False

    def sync_organization_users(self, *, tenant_id: UUID, actor_user_id: UUID | None) -> M365UserSyncResult:
        if not self._directory.configured:
            raise AppException(
                "Microsoft 365 directory sync is not configured. "
                "Set MICROSOFT_TENANT_ID, MICROSOFT_CLIENT_ID, and MICROSOFT_CLIENT_SECRET.",
                status_code=503,
            )

        directory_users = self._dedupe_directory_users(self._directory.list_users_for_domain())
        if not directory_users:
            raise AppException(
                f"No Microsoft 365 users found for @{self._directory.email_domain}.",
                status_code=404,
            )

        admin_emails = settings.microsoft_platform_admin_email_set()
        super_admin_role = self._ensure_role(tenant_id, "SUPER_ADMIN", "Super Admin")
        self._ensure_role(tenant_id, "TENANT_ADMIN", "Tenant Admin")
        primary_company, primary_branch = self._org.get_tenant_primary_org(tenant_id)

        created = 0
        updated = 0

        for spec in directory_users:
            email = spec.email
            is_admin = email in admin_emails
            user, was_created = self._upsert_user(
                tenant_id=tenant_id,
                actor_user_id=actor_user_id,
                email=email,
                display_name=spec.display_name,
                is_admin=is_admin,
            )
            if was_created:
                created += 1
            else:
                updated += 1

            if is_admin:
                link = self._db.scalar(
                    select(SecUserRole).where(
                        SecUserRole.user_id == user.id,
                        SecUserRole.role_id == super_admin_role.id,
                    )
                )
                if not link:
                    self._users.assign_role(
                        tenant_id=tenant_id,
                        user_id=user.id,
                        role_id=super_admin_role.id,
                        assigned_by=actor_user_id,
                    )
            else:
                self._strip_admin_roles(user.id)

            if primary_company is not None:
                self._org.ensure_default_scope(
                    tenant_id=tenant_id,
                    user_id=user.id,
                    company_id=primary_company.id,
                    branch_id=primary_branch.id if primary_branch else None,
                )

            link_ctx = TenantContext(
                tenant_id=tenant_id,
                user_id=user.id,
                user_type=user.user_type,
                company_id=primary_company.id if primary_company else None,
                branch_id=primary_branch.id if primary_branch else None,
            )
            # Links existing employee by email/user_id or creates one — never duplicates.
            self._user_employee.ensure_employee_for_user(link_ctx, user)

        self._db.flush()
        return M365UserSyncResult(
            domain=self._directory.email_domain,
            directory_count=len(directory_users),
            created=created,
            updated=updated,
        )
