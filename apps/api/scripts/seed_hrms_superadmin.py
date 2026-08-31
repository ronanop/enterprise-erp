"""Seed the hidden HRMS Superadmin and expand HR_ADMIN workspace permissions.

Creates:
  - Login: hr@cachedigitech.com / CacheHr@2026
  - user_type super_admin, SUPER_ADMIN role
  - No master_employee row (hidden from employee directory / ESS)
  - hr.superadmin:manage granted only to SUPER_ADMIN
  - HR_ADMIN role gets full HRMS sidebar permissions (not Superadmin Panel)

Usage (from apps/api):
  python -m scripts.seed_hrms_superadmin
"""

from __future__ import annotations

import sys
from datetime import datetime, timezone
from pathlib import Path
from uuid import uuid4

from sqlalchemy import or_, select, text

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT))
sys.path.insert(0, str(ROOT / "src"))

from database.session import SessionLocal  # noqa: E402
from modules.foundation.models.security import (  # noqa: E402
    SecRole,
    SecTenant,
    SecUser,
    SecUserOrgScope,
    SecUserRole,
)
from modules.foundation.service.rbac_service import RBACService  # noqa: E402
from modules.foundation.service.user_service import UserService  # noqa: E402
from modules.hr.permissions import (  # noqa: E402
    HR_ADMIN_WORKSPACE_PERMISSIONS,
    HR_PERMISSIONS,
    HR_SUPERADMIN_PERMISSION,
)
from modules.master_data.models.employee import MasterEmployee  # noqa: E402
from modules.organization.models.branch import OrgBranch  # noqa: E402
from modules.organization.models.company import OrgCompany  # noqa: E402
from security.password import PasswordHasher  # noqa: E402

HRMS_ADMIN_EMAIL = "hr@cachedigitech.com"
HRMS_ADMIN_PASSWORD = "CacheHr@2026"
HRMS_ADMIN_NAME = "HRMS Superadmin"


def utcnow() -> datetime:
    return datetime.now(timezone.utc)


def ensure_permission(db, code: str, resource: str, action: str, module: str) -> str:
    row = db.execute(
        text("SELECT id FROM foundation.sec_permission WHERE permission_code = :code"),
        {"code": code},
    ).first()
    if row:
        return str(row[0])
    perm_id = str(uuid4())
    db.execute(
        text(
            """
            INSERT INTO foundation.sec_permission
            (id, permission_code, resource, action, description, module, is_active, created_at)
            VALUES (:id, :code, :resource, :action, NULL, :module, true, :now)
            """
        ),
        {
            "id": perm_id,
            "code": code,
            "resource": resource,
            "action": action,
            "module": module,
            "now": utcnow(),
        },
    )
    return perm_id


def ensure_role(db, tenant_id, role_code: str, role_name: str) -> SecRole:
    role = db.scalar(
        select(SecRole).where(
            SecRole.tenant_id == tenant_id,
            SecRole.role_code == role_code,
            SecRole.is_deleted.is_(False),
        )
    )
    if role:
        return role
    role = SecRole(
        id=uuid4(),
        tenant_id=tenant_id,
        role_code=role_code,
        role_name=role_name,
        is_system_role=True,
        status="active",
    )
    db.add(role)
    db.flush()
    return role


def grant_codes(db, tenant_id, role_id, codes: list[str]) -> int:
    granted = 0
    now = utcnow()
    for code in codes:
        perm = db.execute(
            text("SELECT id FROM foundation.sec_permission WHERE permission_code = :code"),
            {"code": code},
        ).first()
        if not perm:
            continue
        exists = db.execute(
            text(
                """
                SELECT 1 FROM foundation.sec_role_permission
                WHERE role_id = :rid AND permission_id = :pid
                """
            ),
            {"rid": str(role_id), "pid": str(perm[0])},
        ).first()
        if exists:
            continue
        db.execute(
            text(
                """
                INSERT INTO foundation.sec_role_permission
                (id, tenant_id, role_id, permission_id, granted_at)
                VALUES (:id, :tid, :rid, :pid, :now)
                """
            ),
            {
                "id": str(uuid4()),
                "tid": str(tenant_id),
                "rid": str(role_id),
                "pid": str(perm[0]),
                "now": now,
            },
        )
        granted += 1
    return granted


def revoke_code_from_role(db, role_id, code: str) -> None:
    db.execute(
        text(
            """
            DELETE FROM foundation.sec_role_permission
            WHERE role_id = :rid
              AND permission_id = (
                SELECT id FROM foundation.sec_permission WHERE permission_code = :code
              )
            """
        ),
        {"rid": str(role_id), "code": code},
    )


def ensure_org_scope(db, tenant_id, user: SecUser, company: OrgCompany, branch: OrgBranch) -> None:
    exists = db.scalar(
        select(SecUserOrgScope).where(
            SecUserOrgScope.user_id == user.id,
            SecUserOrgScope.company_id == company.id,
        )
    )
    if exists:
        return
    db.add(
        SecUserOrgScope(
            id=uuid4(),
            tenant_id=tenant_id,
            user_id=user.id,
            company_id=company.id,
            branch_id=branch.id,
            is_default=True,
            assigned_at=utcnow(),
        )
    )


def main() -> None:
    from scripts.seed_all_permissions import ensure_permissions

    db = SessionLocal()
    try:
        tenant = db.scalar(select(SecTenant).where(SecTenant.tenant_code == "BOOTSTRAP"))
        if tenant is None:
            tenant = db.scalar(select(SecTenant).where(SecTenant.is_deleted.is_(False)))
        if tenant is None:
            raise SystemExit("No tenant found. Run scripts.seed_demo_data first.")

        ensure_permissions(db)
        for code, resource, action, module in HR_PERMISSIONS:
            ensure_permission(db, code, resource, action, module)

        super_role = ensure_role(db, tenant.id, "SUPER_ADMIN", "Super Admin")
        tenant_role = ensure_role(db, tenant.id, "TENANT_ADMIN", "Tenant Admin")
        hr_admin_role = ensure_role(db, tenant.id, "HR_ADMIN", "HR Admin")

        all_codes = [
            r[0]
            for r in db.execute(
                text("SELECT permission_code FROM foundation.sec_permission WHERE is_active = true")
            ).all()
        ]
        grant_codes(db, tenant.id, super_role.id, all_codes)
        grant_codes(db, tenant.id, super_role.id, [HR_SUPERADMIN_PERMISSION])
        revoke_code_from_role(db, tenant_role.id, HR_SUPERADMIN_PERMISSION)
        revoke_code_from_role(db, hr_admin_role.id, HR_SUPERADMIN_PERMISSION)
        grant_codes(db, tenant.id, hr_admin_role.id, HR_ADMIN_WORKSPACE_PERMISSIONS)

        service = UserService(db)
        user = db.scalar(
            select(SecUser).where(
                SecUser.tenant_id == tenant.id,
                SecUser.email == HRMS_ADMIN_EMAIL,
                SecUser.is_deleted.is_(False),
            )
        )
        if user is None:
            created = service.create_user(
                tenant_id=tenant.id,
                email=HRMS_ADMIN_EMAIL,
                password=HRMS_ADMIN_PASSWORD,
                display_name=HRMS_ADMIN_NAME,
                user_type="super_admin",
                created_by=None,
            )
            user = db.scalar(select(SecUser).where(SecUser.id == created.id))
            assert user is not None
        else:
            user.password_hash = PasswordHasher.hash_password(HRMS_ADMIN_PASSWORD)
            user.display_name = HRMS_ADMIN_NAME
            user.user_type = "super_admin"
            user.status = "active"
            user.failed_login_count = 0
            user.locked_until = None
            user.must_change_password = False

        already = db.scalar(
            select(SecUserRole).where(
                SecUserRole.user_id == user.id,
                SecUserRole.role_id == super_role.id,
            )
        )
        if not already:
            service.assign_role(
                tenant_id=tenant.id,
                user_id=user.id,
                role_id=super_role.id,
                assigned_by=None,
            )

        company = db.scalar(
            select(OrgCompany).where(
                OrgCompany.tenant_id == tenant.id,
                OrgCompany.is_deleted.is_(False),
            )
        )
        branch = None
        if company:
            branch = db.scalar(
                select(OrgBranch).where(
                    OrgBranch.company_id == company.id,
                    OrgBranch.is_deleted.is_(False),
                )
            )
        if company and branch:
            ensure_org_scope(db, tenant.id, user, company, branch)

        linked = db.scalars(
            select(MasterEmployee).where(
                MasterEmployee.tenant_id == tenant.id,
                MasterEmployee.is_deleted.is_(False),
                or_(MasterEmployee.user_id == user.id, MasterEmployee.email == HRMS_ADMIN_EMAIL),
            )
        ).all()
        now = utcnow()
        for emp in linked:
            emp.user_id = None
            emp.is_deleted = True
            emp.deleted_at = now
            emp.status = "ex_employee"

        try:
            RBACService(db).invalidate_user(user.id)
        except Exception:
            pass

        db.commit()
        print("=" * 60)
        print("HRMS Superadmin seeded")
        print(f"  Email    : {HRMS_ADMIN_EMAIL}")
        print(f"  Password : {HRMS_ADMIN_PASSWORD}")
        print("  Role     : SUPER_ADMIN (hidden from employee directory)")
        print("  Login    : ERP web — not Employee App")
        print("=" * 60)
        print("Sign out and sign in again so the session reloads permissions.")
    except Exception:
        db.rollback()
        raise
    finally:
        db.close()


if __name__ == "__main__":
    main()
