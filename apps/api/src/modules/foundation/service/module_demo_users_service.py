"""Seed demo module users (HRMS employee + login + module assignment) for local/demo tenants."""

from __future__ import annotations

from datetime import date, datetime, timezone
from uuid import UUID, uuid4

from sqlalchemy import select, text
from sqlalchemy.orm import Session

from core.exceptions import AppException
from modules.foundation.domain.value_objects import TenantContext
from modules.foundation.models.security import (
    SecPermission,
    SecRole,
    SecRolePermission,
    SecUser,
    SecUserModule,
    SecUserOrgScope,
    SecUserRole,
)
from modules.foundation.service.module_admin_service import ModuleAdminService
from modules.foundation.service.user_service import UserService

# Marketing demo constants removed — standalone HRMS.
MARKETING_FUNCTIONAL_ROLES: tuple[tuple[str, str], ...] = ()
MARKETING_ROLE_APPROVAL_HEAD = "approval_head"
MARKETING_ROLE_ASSOCIATE = "marketing_associate"
MARKETING_ROLE_CONTENT_CREATOR = "content_creator"
MARKETING_ROLE_GRAPHIC_DESIGNER = "graphic_designer"
MARKETING_ROLE_HEAD = "marketing_head"
MARKETING_ROLE_SUPPORTING_MEMBER = "supporting_member"
MARKETING_ROLE_VIDEO_EDITOR = "video_editor"
MARKETING_EDITOR_PERMISSIONS: tuple[str, ...] = ()
MARKETING_MANAGER_PERMISSIONS: tuple[str, ...] = ()
MARKETING_VIEWER_PERMISSIONS: tuple[str, ...] = ()
from modules.master_data.models.employee import MasterEmployee
from modules.organization.models.branch import OrgBranch
from modules.organization.models.company import OrgCompany
from modules.organization.models.hierarchy import OrgDepartment
from security.password import PasswordHasher

DEMO_PASSWORD = "Secure1!"

MARKETING_DEMO_SPECS: tuple[dict, ...] = (
    {
        "email": "marketing.head@example.com",
        "display_name": "Maya Head",
        "first_name": "Maya",
        "last_name": "Head",
        "employee_code": "MKT9201",
        "designation": "Marketing Head",
        "module_role": MARKETING_ROLE_HEAD,
        "role_code": "MKT_DEMO_HEAD",
        "permissions": MARKETING_MANAGER_PERMISSIONS,
        "mobile_suffix": "9201",
    },
    {
        "email": "marketing.associate@example.com",
        "display_name": "Aryan Associate",
        "first_name": "Aryan",
        "last_name": "Associate",
        "employee_code": "MKT9202",
        "designation": "Marketing Associate",
        "module_role": MARKETING_ROLE_ASSOCIATE,
        "role_code": "MKT_DEMO_ASSOCIATE",
        "permissions": MARKETING_MANAGER_PERMISSIONS,
        "mobile_suffix": "9202",
    },
    {
        "email": "marketing.video@example.com",
        "display_name": "Vikram Editor",
        "first_name": "Vikram",
        "last_name": "Editor",
        "employee_code": "MKT9203",
        "designation": "Video Editor",
        "module_role": MARKETING_ROLE_VIDEO_EDITOR,
        "role_code": "MKT_DEMO_VIDEO",
        "permissions": MARKETING_EDITOR_PERMISSIONS,
        "mobile_suffix": "9203",
    },
    {
        "email": "marketing.design@example.com",
        "display_name": "Diya Designer",
        "first_name": "Diya",
        "last_name": "Designer",
        "employee_code": "MKT9204",
        "designation": "Graphic Designer",
        "module_role": MARKETING_ROLE_GRAPHIC_DESIGNER,
        "role_code": "MKT_DEMO_DESIGN",
        "permissions": MARKETING_EDITOR_PERMISSIONS,
        "mobile_suffix": "9204",
    },
    {
        "email": "marketing.content@example.com",
        "display_name": "Kabir Creator",
        "first_name": "Kabir",
        "last_name": "Creator",
        "employee_code": "MKT9205",
        "designation": "Content Creator",
        "module_role": MARKETING_ROLE_CONTENT_CREATOR,
        "role_code": "MKT_DEMO_CONTENT",
        "permissions": MARKETING_EDITOR_PERMISSIONS,
        "mobile_suffix": "9205",
    },
    {
        "email": "marketing.approval@example.com",
        "display_name": "Ananya Approver",
        "first_name": "Ananya",
        "last_name": "Approver",
        "employee_code": "MKT9206",
        "designation": "Approval Head",
        "module_role": MARKETING_ROLE_APPROVAL_HEAD,
        "role_code": "MKT_DEMO_APPROVAL",
        "permissions": MARKETING_MANAGER_PERMISSIONS,
        "mobile_suffix": "9206",
    },
    {
        "email": "marketing.support@example.com",
        "display_name": "Sana Support",
        "first_name": "Sana",
        "last_name": "Support",
        "employee_code": "MKT9207",
        "designation": "Marketing Support",
        "module_role": MARKETING_ROLE_SUPPORTING_MEMBER,
        "role_code": "MKT_DEMO_SUPPORT",
        "permissions": MARKETING_VIEWER_PERMISSIONS,
        "mobile_suffix": "9207",
    },
)


def utcnow() -> datetime:
    return datetime.now(timezone.utc)


class ModuleDemoUsersService:
    def __init__(self, db: Session) -> None:
        self._db = db
        self._admins = ModuleAdminService(db)

    def seed_demo_users(self, ctx: TenantContext, module_key: str) -> dict:
        self._admins.ensure_module_admin(ctx, module_key)
        if module_key != "marketing":
            raise AppException("Demo user seeding is currently available for Marketing only")

        company, branch, department = self._resolve_org(ctx)
        perm_map = self._permission_map()
        created = 0
        updated = 0
        accounts: list[dict] = []

        for spec in MARKETING_DEMO_SPECS:
            user, was_created = self._ensure_user(ctx.tenant_id, spec, created_by=ctx.user_id)
            self._ensure_employee(
                ctx.tenant_id,
                company.id,
                branch.id,
                department.id,
                user,
                spec,
                actor_id=ctx.user_id,
            )
            self._ensure_org_scope(ctx.tenant_id, user.id, company.id, branch.id)
            self._ensure_module_role(
                ctx.tenant_id,
                user.id,
                module_key="marketing",
                role=spec["module_role"],
                assigned_by=ctx.user_id,
            )
            self._ensure_rbac_role(
                ctx.tenant_id,
                user.id,
                role_code=spec["role_code"],
                role_name=spec["designation"],
                permission_codes=spec["permissions"],
                perm_map=perm_map,
            )
            if was_created:
                created += 1
            else:
                updated += 1
            accounts.append(
                {
                    "email": spec["email"],
                    "display_name": spec["display_name"],
                    "role": spec["module_role"],
                    "role_label": dict(MARKETING_FUNCTIONAL_ROLES).get(
                        spec["module_role"], spec["module_role"]
                    ),
                }
            )

        return {
            "module_key": module_key,
            "created": created,
            "updated": updated,
            "password": DEMO_PASSWORD,
            "accounts": accounts,
        }

    def _resolve_org(self, ctx: TenantContext) -> tuple[OrgCompany, OrgBranch, OrgDepartment]:
        company = None
        if ctx.company_id:
            company = self._db.get(OrgCompany, ctx.company_id)
        if company is None:
            company = self._db.scalar(
                select(OrgCompany)
                .where(
                    OrgCompany.tenant_id == ctx.tenant_id,
                    OrgCompany.is_deleted.is_(False),
                )
                .order_by(OrgCompany.created_at.asc())
            )
        if company is None:
            raise AppException("No company found — seed organization first")

        branch = None
        if ctx.branch_id:
            branch = self._db.get(OrgBranch, ctx.branch_id)
        if branch is None or branch.company_id != company.id:
            branch = self._db.scalar(
                select(OrgBranch)
                .where(
                    OrgBranch.company_id == company.id,
                    OrgBranch.is_deleted.is_(False),
                )
                .order_by(OrgBranch.created_at.asc())
            )
        if branch is None:
            raise AppException("No branch found for company — seed organization first")

        department = self._db.scalar(
            select(OrgDepartment)
            .where(
                OrgDepartment.company_id == company.id,
                OrgDepartment.branch_id == branch.id,
                OrgDepartment.is_deleted.is_(False),
            )
            .order_by(OrgDepartment.created_at.asc())
        )
        if department is None:
            department = OrgDepartment(
                id=uuid4(),
                tenant_id=ctx.tenant_id,
                company_id=company.id,
                branch_id=branch.id,
                department_code="MKT",
                department_name="Marketing",
                status="active",
                created_by=ctx.user_id,
                updated_by=ctx.user_id,
            )
            self._db.add(department)
            self._db.flush()
        return company, branch, department

    def _permission_map(self) -> dict[str, UUID]:
        rows = self._db.execute(
            text(
                "SELECT permission_code, id FROM foundation.sec_permission "
                "WHERE is_active = true AND permission_code LIKE 'marketing.%'"
            )
        ).all()
        return {str(code): pid for code, pid in rows}

    def _ensure_user(
        self, tenant_id: UUID, spec: dict, *, created_by: UUID | None
    ) -> tuple[SecUser, bool]:
        existing = self._db.scalar(
            select(SecUser).where(
                SecUser.tenant_id == tenant_id,
                SecUser.email == spec["email"],
                SecUser.is_deleted.is_(False),
            )
        )
        if existing:
            existing.password_hash = PasswordHasher.hash_password(DEMO_PASSWORD)
            existing.display_name = spec["display_name"]
            existing.failed_login_count = 0
            existing.locked_until = None
            if existing.status in {"locked", "inactive"}:
                existing.status = "active"
            self._db.flush()
            return existing, False

        created = UserService(self._db).create_user(
            tenant_id=tenant_id,
            email=spec["email"],
            password=DEMO_PASSWORD,
            display_name=spec["display_name"],
            user_type="employee",
            created_by=created_by,
        )
        user = self._db.get(SecUser, created.id)
        assert user is not None
        return user, True

    def _ensure_employee(
        self,
        tenant_id: UUID,
        company_id: UUID,
        branch_id: UUID,
        department_id: UUID,
        user: SecUser,
        spec: dict,
        *,
        actor_id: UUID | None,
    ) -> MasterEmployee:
        emp = self._db.scalar(
            select(MasterEmployee).where(
                MasterEmployee.company_id == company_id,
                MasterEmployee.employee_code == spec["employee_code"],
                MasterEmployee.is_deleted.is_(False),
            )
        )
        if emp is None:
            emp = MasterEmployee(
                id=uuid4(),
                tenant_id=tenant_id,
                company_id=company_id,
                branch_id=branch_id,
                department_id=department_id,
                employee_code=spec["employee_code"],
                first_name=spec["first_name"],
                last_name=spec["last_name"],
                email=spec["email"],
                mobile=f"+91-92000-{spec['mobile_suffix']}",
                designation=spec["designation"],
                date_of_joining=date(2024, 6, 1),
                status="active",
                user_id=user.id,
                created_by=actor_id,
                updated_by=actor_id,
            )
            self._db.add(emp)
            self._db.flush()
        else:
            emp.first_name = spec["first_name"]
            emp.last_name = spec["last_name"]
            emp.email = spec["email"]
            emp.mobile = f"+91-92000-{spec['mobile_suffix']}"
            emp.designation = spec["designation"]
            emp.status = "active"
            emp.user_id = user.id
            emp.updated_by = actor_id
            self._db.flush()
        user.employee_id = emp.id
        self._db.flush()
        return emp

    def _ensure_org_scope(
        self, tenant_id: UUID, user_id: UUID, company_id: UUID, branch_id: UUID
    ) -> None:
        scope = self._db.scalar(
            select(SecUserOrgScope).where(
                SecUserOrgScope.user_id == user_id,
                SecUserOrgScope.company_id == company_id,
            )
        )
        if scope:
            return
        self._db.add(
            SecUserOrgScope(
                id=uuid4(),
                tenant_id=tenant_id,
                user_id=user_id,
                company_id=company_id,
                branch_id=branch_id,
                is_default=True,
                assigned_at=utcnow(),
                assigned_by=None,
            )
        )
        self._db.flush()

    def _ensure_module_role(
        self,
        tenant_id: UUID,
        user_id: UUID,
        *,
        module_key: str,
        role: str,
        assigned_by: UUID | None,
    ) -> None:
        existing = self._db.scalar(
            select(SecUserModule).where(
                SecUserModule.tenant_id == tenant_id,
                SecUserModule.user_id == user_id,
                SecUserModule.module_key == module_key,
            )
        )
        if existing is None:
            self._db.add(
                SecUserModule(
                    id=uuid4(),
                    tenant_id=tenant_id,
                    user_id=user_id,
                    module_key=module_key,
                    role=role,
                    assigned_at=utcnow(),
                    assigned_by=assigned_by,
                )
            )
        else:
            # Do not demote module admins seeded from Organization → Users.
            if existing.role != "admin":
                existing.role = role
                existing.assigned_by = assigned_by
                existing.assigned_at = utcnow()
        self._db.flush()

    def _ensure_rbac_role(
        self,
        tenant_id: UUID,
        user_id: UUID,
        *,
        role_code: str,
        role_name: str,
        permission_codes: list[str],
        perm_map: dict[str, UUID],
    ) -> None:
        role = self._db.scalar(
            select(SecRole).where(
                SecRole.tenant_id == tenant_id,
                SecRole.role_code == role_code,
                SecRole.is_deleted.is_(False),
            )
        )
        if role is None:
            role = SecRole(
                id=uuid4(),
                tenant_id=tenant_id,
                role_code=role_code,
                role_name=role_name,
                is_system_role=True,
                status="active",
            )
            self._db.add(role)
            self._db.flush()

        for code in dict.fromkeys(permission_codes):
            perm_id = perm_map.get(code)
            if not perm_id:
                # Fallback lookup if cache missed.
                perm = self._db.scalar(
                    select(SecPermission).where(SecPermission.permission_code == code)
                )
                if perm is None:
                    continue
                perm_id = perm.id
            exists = self._db.scalar(
                select(SecRolePermission).where(
                    SecRolePermission.role_id == role.id,
                    SecRolePermission.permission_id == perm_id,
                )
            )
            if exists:
                continue
            self._db.add(
                SecRolePermission(
                    id=uuid4(),
                    tenant_id=tenant_id,
                    role_id=role.id,
                    permission_id=perm_id,
                    granted_at=utcnow(),
                )
            )

        linked = self._db.scalar(
            select(SecUserRole).where(
                SecUserRole.user_id == user_id,
                SecUserRole.role_id == role.id,
            )
        )
        if linked is None:
            self._db.add(
                SecUserRole(
                    id=uuid4(),
                    tenant_id=tenant_id,
                    user_id=user_id,
                    role_id=role.id,
                    assigned_at=utcnow(),
                    assigned_by=None,
                )
            )
        self._db.flush()
