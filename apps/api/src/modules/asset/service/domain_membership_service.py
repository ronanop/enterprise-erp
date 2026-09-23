"""Domain membership service — assign users to IT / Non-IT asset teams."""

from __future__ import annotations

from uuid import UUID

from sqlalchemy import select
from sqlalchemy.orm import Session

from core.exceptions import AppException, ConflictException, ForbiddenException, NotFoundException
from modules.asset.domain.enums import (
    ASSET_DOMAIN_VALUES,
    DOMAIN_MEMBERSHIP_ROLE_VALUES,
    DomainMembershipRole,
)
from modules.asset.repository.domain_membership_repository import DomainMembershipRepository
from modules.asset.service.asset_scope_validator import AssetScopeValidator
from modules.foundation.domain.value_objects import TenantContext
from modules.foundation.service.audit_service import AuditService
from modules.foundation.service.rbac_service import RBACService
from modules.organization.models.company import OrgCompany


class DomainMembershipService:
    def __init__(self, db: Session) -> None:
        self._db = db
        self._repo = DomainMembershipRepository(db)
        self._scope = AssetScopeValidator(db)
        self._audit = AuditService(db)
        self._rbac = RBACService(db)

    def is_module_admin(self, ctx: TenantContext) -> bool:
        if ctx.user_id is None:
            return False
        if ctx.user_type in {"super_admin", "tenant_admin"}:
            return True
        return self._rbac.has_permission(ctx.user_id, ctx.tenant_id, "asset.module:admin")

    def user_domains(self, ctx: TenantContext, user_id: UUID | None = None) -> list[str]:
        uid = user_id or ctx.user_id
        if uid is None:
            return []
        rows = self._repo.list_rows(ctx, user_id=uid)
        return sorted({row.domain for row in rows})

    def admin_domains(self, ctx: TenantContext) -> list[str]:
        if self.is_module_admin(ctx):
            return list(ASSET_DOMAIN_VALUES)
        if ctx.user_id is None:
            return []
        rows = self._repo.list_rows(ctx, user_id=ctx.user_id)
        return sorted({row.domain for row in rows if row.role == DomainMembershipRole.ADMIN.value})

    def is_domain_admin(self, ctx: TenantContext, domain: str) -> bool:
        if self.is_module_admin(ctx):
            return True
        return domain in self.admin_domains(ctx)

    def can_access_domain(self, ctx: TenantContext, domain: str) -> bool:
        if domain not in ASSET_DOMAIN_VALUES:
            return False
        if self.is_module_admin(ctx):
            return True
        return domain in self.user_domains(ctx)

    def my_access(self, ctx: TenantContext) -> dict:
        domains = self.user_domains(ctx)
        module_admin = self.is_module_admin(ctx)
        admin_domains = self.admin_domains(ctx)
        return {
            "is_module_admin": module_admin,
            "domains": list(ASSET_DOMAIN_VALUES) if module_admin else domains,
            "admin_domains": admin_domains,
            "memberships": [
                {
                    "id": row.id,
                    "domain": row.domain,
                    "role": row.role,
                }
                for row in self._repo.list_rows(ctx, user_id=ctx.user_id)
            ],
        }

    def ensure_can_manage_any(self, ctx: TenantContext) -> None:
        if self.is_module_admin(ctx):
            return
        if not self.admin_domains(ctx):
            raise ForbiddenException("Domain admin or asset module admin required")

    def ensure_can_manage_domain(
        self,
        ctx: TenantContext,
        domain: str,
        *,
        target_role: str | None = None,
        existing_role: str | None = None,
    ) -> None:
        """Authorize domain membership management.

        Domain admins may manage ``member`` rows for their domain.
        Only module admins may assign or change the ``admin`` role.
        """
        if domain not in ASSET_DOMAIN_VALUES:
            raise AppException(f"domain must be one of: {', '.join(sorted(ASSET_DOMAIN_VALUES))}")
        module_admin = self.is_module_admin(ctx)
        if not module_admin and not self.is_domain_admin(ctx, domain):
            raise ForbiddenException("Domain admin or asset module admin required")
        if target_role == DomainMembershipRole.ADMIN.value and not module_admin:
            raise ForbiddenException("Only asset module admins can assign domain admin role")
        if existing_role == DomainMembershipRole.ADMIN.value and not module_admin:
            raise ForbiddenException("Only asset module admins can change domain admin memberships")

    def list(
        self,
        ctx: TenantContext,
        *,
        company_id: UUID | None = None,
        domain: str | None = None,
    ) -> list[dict]:
        if domain is not None and domain not in ASSET_DOMAIN_VALUES:
            raise AppException(f"domain must be one of: {', '.join(sorted(ASSET_DOMAIN_VALUES))}")
        # Tenant-scoped list; company_id is an optional explicit filter only.
        cid: UUID | None = None
        if company_id is not None:
            cid = self._scope.resolve_company_id(ctx, company_id)

        if domain is not None:
            self.ensure_can_manage_domain(ctx, domain)
        else:
            self.ensure_can_manage_any(ctx)

        rows = self._repo.list_rows(ctx, company_id=cid, domain=domain)
        if not self.is_module_admin(ctx) and domain is None:
            allowed = set(self.admin_domains(ctx))
            rows = [r for r in rows if r.domain in allowed]

        users = self._repo.users_by_ids(ctx.tenant_id, [r.user_id for r in rows])
        out: list[dict] = []
        for row in rows:
            user = users.get(row.user_id)
            out.append(
                {
                    "id": row.id,
                    "user_id": row.user_id,
                    "display_name": user.display_name if user else None,
                    "email": user.email if user else None,
                    "domain": row.domain,
                    "role": row.role,
                    "assigned_at": row.assigned_at,
                    "assigned_by": row.assigned_by,
                    "company_id": row.company_id,
                    "version": row.version,
                }
            )
        return out

    def list_assignable_users(self, ctx: TenantContext) -> list[dict]:
        self.ensure_can_manage_any(ctx)
        return [
            {
                "user_id": u.id,
                "display_name": u.display_name,
                "email": u.email,
            }
            for u in self._repo.list_assignable_users(ctx)
        ]

    def create(
        self,
        ctx: TenantContext,
        *,
        user_id: UUID,
        domain: str,
        role: str = DomainMembershipRole.MEMBER.value,
        company_id: UUID | None = None,
    ) -> dict:
        self._validate_domain_role(domain, role)
        self.ensure_can_manage_domain(ctx, domain, target_role=role)
        cid = self._resolve_company_for_write(ctx, company_id)
        existing = self._repo.get_active(ctx, user_id=user_id, domain=domain)
        if existing is not None:
            raise ConflictException("User already has a membership for this domain")
        users = self._repo.users_by_ids(ctx.tenant_id, [user_id])
        if user_id not in users:
            raise NotFoundException("User not found")
        row = self._repo.create(
            ctx,
            company_id=cid,
            user_id=user_id,
            domain=domain,
            role=role,
        )
        self._audit.log_entity_change(
            tenant_id=ctx.tenant_id,
            entity_name="ast_domain_membership",
            entity_id=row.id,
            operation="create",
            performed_by=ctx.user_id,
            new_value={"user_id": str(user_id), "domain": domain, "role": role},
        )
        user = users[user_id]
        return {
            "id": row.id,
            "user_id": row.user_id,
            "display_name": user.display_name,
            "email": user.email,
            "domain": row.domain,
            "role": row.role,
            "assigned_at": row.assigned_at,
            "assigned_by": row.assigned_by,
            "company_id": row.company_id,
            "version": row.version,
        }

    def update_role(self, ctx: TenantContext, row_id: UUID, role: str) -> dict:
        if role not in DOMAIN_MEMBERSHIP_ROLE_VALUES:
            raise AppException(
                f"role must be one of: {', '.join(sorted(DOMAIN_MEMBERSHIP_ROLE_VALUES))}"
            )
        row = self._repo.get(ctx, row_id)
        if row is None:
            raise NotFoundException("Domain membership not found")
        self.ensure_can_manage_domain(
            ctx,
            row.domain,
            target_role=role,
            existing_role=row.role,
        )
        self._repo.update_role(ctx, row, role)
        self._audit.log_entity_change(
            tenant_id=ctx.tenant_id,
            entity_name="ast_domain_membership",
            entity_id=row.id,
            operation="update",
            performed_by=ctx.user_id,
            new_value={"role": role},
        )
        users = self._repo.users_by_ids(ctx.tenant_id, [row.user_id])
        user = users.get(row.user_id)
        return {
            "id": row.id,
            "user_id": row.user_id,
            "display_name": user.display_name if user else None,
            "email": user.email if user else None,
            "domain": row.domain,
            "role": row.role,
            "assigned_at": row.assigned_at,
            "assigned_by": row.assigned_by,
            "company_id": row.company_id,
            "version": row.version,
        }

    def deactivate(self, ctx: TenantContext, row_id: UUID) -> None:
        row = self._repo.get(ctx, row_id)
        if row is None:
            raise NotFoundException("Domain membership not found")
        self.ensure_can_manage_domain(
            ctx,
            row.domain,
            existing_role=row.role,
        )
        self._repo.soft_delete(ctx, row)
        self._audit.log_entity_change(
            tenant_id=ctx.tenant_id,
            entity_name="ast_domain_membership",
            entity_id=row.id,
            operation="delete",
            performed_by=ctx.user_id,
            new_value={"domain": row.domain, "user_id": str(row.user_id)},
        )

    def _resolve_company_for_write(
        self, ctx: TenantContext, company_id: UUID | None
    ) -> UUID:
        if company_id is not None:
            return self._scope.resolve_company_id(ctx, company_id)
        if ctx.company_id is not None:
            return ctx.company_id
        stmt = (
            select(OrgCompany.id)
            .where(
                OrgCompany.tenant_id == ctx.tenant_id,
                OrgCompany.is_deleted.is_(False),
            )
            .order_by(OrgCompany.created_at.asc())
            .limit(1)
        )
        cid = self._db.scalar(stmt)
        if cid is None:
            raise ForbiddenException("Company context required")
        return cid

    @staticmethod
    def _validate_domain_role(domain: str, role: str) -> None:
        if domain not in ASSET_DOMAIN_VALUES:
            raise AppException(f"domain must be one of: {', '.join(sorted(ASSET_DOMAIN_VALUES))}")
        if role not in DOMAIN_MEMBERSHIP_ROLE_VALUES:
            raise AppException(
                f"role must be one of: {', '.join(sorted(DOMAIN_MEMBERSHIP_ROLE_VALUES))}"
            )

    def ensure_module_admin(self, ctx: TenantContext) -> None:
        if not self.is_module_admin(ctx):
            raise ForbiddenException("Asset module admin permission required")
