"""Sync Organization Users module-admin assignments to module RBAC roles."""

from __future__ import annotations

from uuid import UUID

from sqlalchemy import select
from sqlalchemy.orm import Session

from modules.foundation.domain.erp_modules import MODULE_ROLE_ADMIN
from modules.foundation.domain.value_objects import TenantContext
from modules.foundation.models.security import SecRole, SecUser, SecUserModule, SecUserRole
from modules.foundation.repository.user_module_repository import UserModuleRepository
from modules.foundation.service.audit_service import AuditService
from modules.foundation.service.rbac_service import RBACService
from modules.foundation.service.user_service import UserService
from modules.hr.service.hr_module_admin import HR_ADMIN_ROLE_CODE
from modules.organization.models.company import OrgCompany
from modules.organization.repository.org_scope_repository import OrgScopeRepository

ASSET_MANAGER_ROLE_CODE = "ASSET_MANAGER"


class OrgModuleAdminSyncService:
    def __init__(self, db: Session) -> None:
        self._db = db
        self._users = UserService(db)
        self._scopes = OrgScopeRepository(db)
        self._rbac = RBACService(db)
        self._audit = AuditService(db)
        self._modules = UserModuleRepository(db)

    def sync_user_admin_modules(
        self,
        tenant_id: UUID,
        user_id: UUID,
        *,
        previous_admin_keys: list[str],
        new_admin_keys: list[str],
        actor_id: UUID | None,
    ) -> None:
        old_set = set(previous_admin_keys)
        new_set = set(new_admin_keys)
        ctx = TenantContext(tenant_id=tenant_id, user_id=actor_id or user_id, user_type="super_admin")

        if "hr" in new_set and "hr" not in old_set:
            self._promote_hr(ctx, user_id, actor_id)
        if "hr" in old_set and "hr" not in new_set:
            self._demote_hr(ctx, user_id, actor_id)

        if "assets" in new_set and "assets" not in old_set:
            self._promote_assets(tenant_id, user_id, actor_id)
        if "assets" in old_set and "assets" not in new_set:
            self._demote_assets(tenant_id, user_id, actor_id)

    def sync_all_org_module_admins(self, tenant_id: UUID) -> None:
        rows = list(
            self._db.scalars(
                select(SecUserModule).where(
                    SecUserModule.tenant_id == tenant_id,
                    SecUserModule.role == MODULE_ROLE_ADMIN,
                )
            ).all()
        )
        by_user: dict[UUID, set[str]] = {}
        for row in rows:
            by_user.setdefault(row.user_id, set()).add(row.module_key)
        for user_id, keys in by_user.items():
            user = self._db.get(SecUser, user_id)
            ctx = TenantContext(
                tenant_id=tenant_id,
                user_id=user_id,
                user_type=user.user_type if user else "employee",
            )
            if "hr" in keys:
                self._promote_hr(ctx, user_id, None)
            if "assets" in keys:
                self._promote_assets(tenant_id, user_id, None)

    def _role(self, tenant_id: UUID, role_code: str) -> SecRole | None:
        return self._db.scalar(
            select(SecRole).where(
                SecRole.tenant_id == tenant_id,
                SecRole.role_code == role_code,
                SecRole.is_deleted.is_(False),
            )
        )

    def _ensure_role(self, tenant_id: UUID, user_id: UUID, role_code: str, actor_id: UUID | None) -> None:
        role = self._role(tenant_id, role_code)
        if role is None:
            return
        exists = self._db.scalar(
            select(SecUserRole.id).where(
                SecUserRole.user_id == user_id,
                SecUserRole.role_id == role.id,
            )
        )
        if exists is None:
            self._users.assign_role(
                tenant_id=tenant_id,
                user_id=user_id,
                role_id=role.id,
                assigned_by=actor_id,
            )

    def _revoke_role(self, tenant_id: UUID, user_id: UUID, role_code: str) -> None:
        role = self._role(tenant_id, role_code)
        if role is None:
            return
        links = self._db.scalars(
            select(SecUserRole).where(
                SecUserRole.user_id == user_id,
                SecUserRole.role_id == role.id,
            )
        ).all()
        for link in links:
            self._db.delete(link)
        self._db.flush()
        self._rbac.invalidate_user(user_id)

    def _all_company_ids(self, tenant_id: UUID) -> list[UUID]:
        rows = self._db.scalars(
            select(OrgCompany.id).where(
                OrgCompany.tenant_id == tenant_id,
                OrgCompany.is_deleted.is_(False),
            )
        ).all()
        return list(rows)

    def _promote_hr(self, ctx: TenantContext, user_id: UUID, actor_id: UUID | None) -> None:
        self._ensure_role(ctx.tenant_id, user_id, HR_ADMIN_ROLE_CODE, actor_id)
        company_ids = self._all_company_ids(ctx.tenant_id)
        user = self._db.get(SecUser, user_id)
        default_company: UUID | None = None
        if user and user.employee_id:
            from modules.master_data.models.employee import MasterEmployee

            emp = self._db.get(MasterEmployee, user.employee_id)
            if emp and emp.company_id:
                default_company = emp.company_id
        if default_company is None and company_ids:
            default_company = company_ids[0]
        if company_ids:
            self._scopes.replace_company_scopes(
                ctx,
                user_id=user_id,
                company_ids=company_ids,
                default_company_id=default_company,
            )
        self._rbac.invalidate_user(user_id)
        self._audit.log_entity_change(
            tenant_id=ctx.tenant_id,
            entity_name="org_module_admin",
            entity_id=user_id,
            operation="promote",
            performed_by=actor_id,
            new_value={"module": "hr", "role": HR_ADMIN_ROLE_CODE},
        )

    def _demote_hr(self, ctx: TenantContext, user_id: UUID, actor_id: UUID | None) -> None:
        self._revoke_role(ctx.tenant_id, user_id, HR_ADMIN_ROLE_CODE)
        user = self._db.get(SecUser, user_id)
        if user and user.employee_id:
            from modules.master_data.models.employee import MasterEmployee

            emp = self._db.get(MasterEmployee, user.employee_id)
            if emp and emp.company_id:
                self._scopes.replace_company_scopes(
                    ctx,
                    user_id=user_id,
                    company_ids=[emp.company_id],
                    default_company_id=emp.company_id,
                )
        self._users.revoke_all_sessions(ctx.tenant_id, user_id, revoked_by=actor_id)
        self._audit.log_entity_change(
            tenant_id=ctx.tenant_id,
            entity_name="org_module_admin",
            entity_id=user_id,
            operation="demote",
            performed_by=actor_id,
            new_value={"module": "hr"},
        )

    def _promote_assets(self, tenant_id: UUID, user_id: UUID, actor_id: UUID | None) -> None:
        self._ensure_role(tenant_id, user_id, ASSET_MANAGER_ROLE_CODE, actor_id)
        self._rbac.invalidate_user(user_id)
        self._audit.log_entity_change(
            tenant_id=tenant_id,
            entity_name="org_module_admin",
            entity_id=user_id,
            operation="promote",
            performed_by=actor_id,
            new_value={"module": "assets", "role": ASSET_MANAGER_ROLE_CODE},
        )

    def _demote_assets(self, tenant_id: UUID, user_id: UUID, actor_id: UUID | None) -> None:
        self._revoke_role(tenant_id, user_id, ASSET_MANAGER_ROLE_CODE)
        self._users.revoke_all_sessions(tenant_id, user_id, revoked_by=actor_id)
        self._audit.log_entity_change(
            tenant_id=tenant_id,
            entity_name="org_module_admin",
            entity_id=user_id,
            operation="demote",
            performed_by=actor_id,
            new_value={"module": "assets"},
        )
