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
from modules.asset.service.asset_module_admin import ASSET_MODULE_KEY
from modules.asset.service.asset_scope_validator import AssetScopeValidator
from modules.foundation.domain.erp_modules import (
    ASSET_IT_MODULE_KEY,
    ASSET_NON_IT_MODULE_KEY,
    ASSET_SUBMODULE_KEYS,
    MODULE_ROLE_ADMIN,
    MODULE_ROLE_MEMBER,
    asset_domain_for_module_key,
)
from modules.foundation.domain.value_objects import TenantContext
from modules.foundation.repository.user_module_repository import UserModuleRepository
from modules.platform.compat.audit_facade import PlatformAuditFacade
from modules.foundation.service.rbac_service import RBACService
from modules.organization.models.company import OrgCompany


class DomainMembershipService:
    def __init__(self, db: Session) -> None:
        self._db = db
        self._repo = DomainMembershipRepository(db)
        self._scope = AssetScopeValidator(db)
        self._audit = PlatformAuditFacade(db)
        self._rbac = RBACService(db)
        self._modules = UserModuleRepository(db)

    def is_module_admin(self, ctx: TenantContext) -> bool:
        """Full Assets admin (both domains) — not a single IT/Non-IT submodule admin."""
        if ctx.user_id is None:
            return False
        if ctx.user_type in {"super_admin", "tenant_admin"}:
            return True
        from modules.asset.service.asset_module_admin import AssetModuleAdminService

        return AssetModuleAdminService(self._db).is_admin(ctx)

    def user_domains(self, ctx: TenantContext, user_id: UUID | None = None) -> list[str]:
        uid = user_id or ctx.user_id
        if uid is None:
            return []
        rows = self._repo.list_rows(ctx, user_id=uid)
        return sorted({row.domain for row in rows})

    def admin_domains(self, ctx: TenantContext) -> list[str]:
        access = self.my_access(ctx)
        return list(access.get("admin_domains") or [])

    def is_domain_admin(self, ctx: TenantContext, domain: str) -> bool:
        return domain in self.admin_domains(ctx)

    def can_access_domain(self, ctx: TenantContext, domain: str) -> bool:
        if domain not in ASSET_DOMAIN_VALUES:
            return False
        access = self.my_access(ctx)
        if access.get("is_module_admin"):
            return True
        return domain in (access.get("domains") or [])

    def _submodule_domain_grants(
        self, tenant_id: UUID, user_id: UUID
    ) -> tuple[set[str], set[str]]:
        """Domains unlocked by Organization → Users assets-it / assets-non-it rows."""
        domains: set[str] = set()
        admin_domains: set[str] = set()
        for key in (ASSET_IT_MODULE_KEY, ASSET_NON_IT_MODULE_KEY):
            row = self._modules.get_assignment(tenant_id, user_id, key)
            if row is None:
                continue
            domain = asset_domain_for_module_key(key)
            if domain is None:
                continue
            domains.add(domain)
            if (row.role or MODULE_ROLE_MEMBER) == MODULE_ROLE_ADMIN:
                admin_domains.add(domain)
        return domains, admin_domains

    def my_access(self, ctx: TenantContext) -> dict:
        memberships = (
            self._repo.list_rows(ctx, user_id=ctx.user_id) if ctx.user_id is not None else []
        )
        membership_domains = {row.domain for row in memberships}
        membership_admin = {
            row.domain for row in memberships if row.role == DomainMembershipRole.ADMIN.value
        }

        sub_domains: set[str] = set()
        sub_admin: set[str] = set()
        if ctx.user_id is not None:
            sub_domains, sub_admin = self._submodule_domain_grants(
                ctx.tenant_id, ctx.user_id
            )

        # Explicit IT / Non-IT Org grants are the source of truth for the sidebar.
        # Do not expand to both domains via leftover asset.module:admin RBAC.
        if sub_domains:
            domains = set(sub_domains)
            admin_domains = set(sub_admin)
            # Keep membership rows that match an assigned submodule only.
            domains |= membership_domains & sub_domains
            admin_domains |= membership_admin & sub_domains
            full_admin = sub_domains == set(ASSET_DOMAIN_VALUES) and sub_admin == set(
                ASSET_DOMAIN_VALUES
            )
            return {
                "is_module_admin": full_admin,
                "domains": sorted(domains),
                "admin_domains": (
                    list(ASSET_DOMAIN_VALUES) if full_admin else sorted(admin_domains)
                ),
                "memberships": [
                    {"id": row.id, "domain": row.domain, "role": row.role}
                    for row in memberships
                ],
            }

        module_admin = self.is_module_admin(ctx)
        domains = set(membership_domains)
        admin_domains = set(membership_admin)
        # Legacy parent-only assets assignment → both domains.
        if ctx.user_id is not None and not domains:
            parent = self._modules.get_assignment(
                ctx.tenant_id, ctx.user_id, ASSET_MODULE_KEY
            )
            if parent is not None:
                domains = set(ASSET_DOMAIN_VALUES)
                if (parent.role or MODULE_ROLE_MEMBER) == MODULE_ROLE_ADMIN:
                    admin_domains = set(ASSET_DOMAIN_VALUES)
                    module_admin = True
        if module_admin:
            domains = set(ASSET_DOMAIN_VALUES)
            admin_domains = set(ASSET_DOMAIN_VALUES)
        return {
            "is_module_admin": module_admin,
            "domains": sorted(domains),
            "admin_domains": sorted(admin_domains),
            "memberships": [
                {"id": row.id, "domain": row.domain, "role": row.role}
                for row in memberships
            ],
        }

    def upsert_from_module_grant(
        self,
        ctx: TenantContext,
        *,
        user_id: UUID,
        module_key: str,
        role: str,
        actor_id: UUID | None = None,
    ) -> None:
        """Mirror Organization → Users assets-it / assets-non-it grants into domain membership."""
        domain = asset_domain_for_module_key(module_key)
        if domain is None:
            return
        membership_role = (
            DomainMembershipRole.ADMIN.value
            if role == MODULE_ROLE_ADMIN
            else DomainMembershipRole.MEMBER.value
        )
        cid = self._resolve_company_for_write(ctx, None)
        write_ctx = TenantContext(
            tenant_id=ctx.tenant_id,
            user_id=actor_id or ctx.user_id,
            user_type=ctx.user_type or "super_admin",
            company_id=ctx.company_id,
        )
        existing = self._repo.get_active(write_ctx, user_id=user_id, domain=domain)
        if existing is not None:
            if existing.role != membership_role:
                self._repo.update_role(write_ctx, existing, membership_role)
        else:
            self._repo.create(
                write_ctx,
                company_id=cid,
                user_id=user_id,
                domain=domain,
                role=membership_role,
            )
        self.ensure_assets_org_member(
            ctx.tenant_id, user_id, assigned_by=actor_id or ctx.user_id
        )
        self.reconcile_parent_asset_assignment(
            ctx.tenant_id, user_id, actor_id=actor_id or ctx.user_id
        )

    def revoke_from_module_grant(
        self,
        ctx: TenantContext,
        *,
        user_id: UUID,
        module_key: str,
        actor_id: UUID | None = None,
    ) -> None:
        """Remove domain membership when an assets-it / assets-non-it grant is revoked."""
        domain = asset_domain_for_module_key(module_key)
        if domain is None:
            return
        write_ctx = TenantContext(
            tenant_id=ctx.tenant_id,
            user_id=actor_id or ctx.user_id,
            user_type=ctx.user_type or "super_admin",
            company_id=ctx.company_id,
        )
        existing = self._repo.get_active(write_ctx, user_id=user_id, domain=domain)
        if existing is not None:
            self._repo.soft_delete(write_ctx, existing)
        self.reconcile_parent_asset_assignment(
            ctx.tenant_id, user_id, actor_id=actor_id or ctx.user_id
        )
        self.release_assets_org_member_if_unused(ctx.tenant_id, user_id)

    def deactivate_all_for_user(
        self,
        tenant_id: UUID,
        user_id: UUID,
        *,
        actor_id: UUID | None = None,
    ) -> int:
        """Soft-delete every active domain membership for a user (assets module revoke)."""
        from modules.asset.models.domain_membership import AstDomainMembership

        rows = list(
            self._db.scalars(
                select(AstDomainMembership).where(
                    AstDomainMembership.tenant_id == tenant_id,
                    AstDomainMembership.user_id == user_id,
                    AstDomainMembership.is_deleted.is_(False),
                )
            ).all()
        )
        write_ctx = TenantContext(
            tenant_id=tenant_id,
            user_id=actor_id or user_id,
            user_type="super_admin",
        )
        for row in rows:
            self._repo.soft_delete(write_ctx, row)
        return len(rows)

    def has_any_asset_submodule(self, tenant_id: UUID, user_id: UUID) -> bool:
        for key in ASSET_SUBMODULE_KEYS:
            if self._modules.get_assignment(tenant_id, user_id, key) is not None:
                return True
        return False

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
            cid = self._scope.resolve_list_company_id(ctx, company_id)

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
        self.ensure_assets_org_member(ctx.tenant_id, user_id, assigned_by=ctx.user_id)
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
        user_id = row.user_id
        self._repo.soft_delete(ctx, row)
        self._audit.log_entity_change(
            tenant_id=ctx.tenant_id,
            entity_name="ast_domain_membership",
            entity_id=row.id,
            operation="delete",
            performed_by=ctx.user_id,
            new_value={"domain": row.domain, "user_id": str(user_id)},
        )
        self.release_assets_org_member_if_unused(ctx.tenant_id, user_id)

    def ensure_assets_org_member(
        self,
        tenant_id: UUID,
        user_id: UUID,
        *,
        assigned_by: UUID | None = None,
    ) -> None:
        """Mirror domain membership into Organization Module users (sec_user_module)."""
        existing = self._modules.get_assignment(tenant_id, user_id, ASSET_MODULE_KEY)
        if existing is not None:
            return
        self._modules.add_member(
            tenant_id=tenant_id,
            user_id=user_id,
            module_key=ASSET_MODULE_KEY,
            assigned_by=assigned_by,
            role=MODULE_ROLE_MEMBER,
        )

    def reconcile_parent_asset_assignment(
        self,
        tenant_id: UUID,
        user_id: UUID,
        *,
        actor_id: UUID | None = None,
    ) -> None:
        """Keep parent ``assets`` as shell member when IT/Non-IT submodules are used.

        Parent ``assets`` admin means full module admin (both domains + ASSET_MANAGER).
        If the user only has one submodule (or mixed member/admin), demote the parent
        so a leftover legacy admin row cannot unlock the other domain.
        """
        it = self._modules.get_assignment(tenant_id, user_id, ASSET_IT_MODULE_KEY)
        non_it = self._modules.get_assignment(tenant_id, user_id, ASSET_NON_IT_MODULE_KEY)
        parent = self._modules.get_assignment(tenant_id, user_id, ASSET_MODULE_KEY)
        if it is None and non_it is None:
            return

        both_admin = (
            it is not None
            and (it.role or MODULE_ROLE_MEMBER) == MODULE_ROLE_ADMIN
            and non_it is not None
            and (non_it.role or MODULE_ROLE_MEMBER) == MODULE_ROLE_ADMIN
        )

        if parent is None:
            self.ensure_assets_org_member(tenant_id, user_id, assigned_by=actor_id)
            parent = self._modules.get_assignment(tenant_id, user_id, ASSET_MODULE_KEY)

        if parent is None:
            return

        # Never auto-promote parent from submodule pairs here — that re-opens both
        # domains via ASSET_MANAGER. Parent admin is set only by an explicit
        # Organization grant of ``assets`` (or both submodules via grant sync).
        if both_admin:
            self._rbac.invalidate_user(user_id)
            return

        # Domain-scoped only — parent must not stay module-admin.
        if (parent.role or MODULE_ROLE_MEMBER) == MODULE_ROLE_ADMIN:
            self._modules.update_role(parent, MODULE_ROLE_MEMBER)
            from modules.foundation.service.org_module_admin_sync_service import (
                ASSET_MANAGER_ROLE_CODE,
                OrgModuleAdminSyncService,
            )

            OrgModuleAdminSyncService(self._db)._revoke_role(
                tenant_id, user_id, ASSET_MANAGER_ROLE_CODE
            )
            self._rbac.invalidate_user(user_id)
        else:
            # Drop stale asset.module:admin cache after submodule-only grants.
            self._rbac.invalidate_user(user_id)

    def release_assets_org_member_if_unused(self, tenant_id: UUID, user_id: UUID) -> None:
        """Drop assets member assignment when no domain/submodule grants remain (keep admins)."""
        from modules.asset.models.domain_membership import AstDomainMembership

        remaining = self._db.scalar(
            select(AstDomainMembership.id)
            .where(
                AstDomainMembership.tenant_id == tenant_id,
                AstDomainMembership.user_id == user_id,
                AstDomainMembership.is_deleted.is_(False),
            )
            .limit(1)
        )
        if remaining is not None:
            return
        if self.has_any_asset_submodule(tenant_id, user_id):
            return
        existing = self._modules.get_assignment(tenant_id, user_id, ASSET_MODULE_KEY)
        if existing is None:
            return
        if (existing.role or MODULE_ROLE_MEMBER) == MODULE_ROLE_ADMIN:
            return
        self._modules.delete_assignment(existing)

    def sync_all_active_to_org_modules(self, tenant_id: UUID) -> int:
        """Backfill sec_user_module assets member for every active domain membership."""
        from modules.asset.models.domain_membership import AstDomainMembership

        user_ids = set(
            self._db.scalars(
                select(AstDomainMembership.user_id).where(
                    AstDomainMembership.tenant_id == tenant_id,
                    AstDomainMembership.is_deleted.is_(False),
                )
            ).all()
        )
        synced = 0
        for user_id in user_ids:
            before = self._modules.get_assignment(tenant_id, user_id, ASSET_MODULE_KEY)
            self.ensure_assets_org_member(tenant_id, user_id)
            after = self._modules.get_assignment(tenant_id, user_id, ASSET_MODULE_KEY)
            if before is None and after is not None:
                synced += 1
        return synced

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
