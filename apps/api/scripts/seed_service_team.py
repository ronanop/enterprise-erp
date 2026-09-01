"""Seed service-module demo team: head, engineers, and stakeholder contacts.

Usage (from apps/api):
  .venv\\Scripts\\python.exe -m scripts.seed_service_team
"""

from __future__ import annotations

import sys
from datetime import date, datetime, timezone
from pathlib import Path
from uuid import uuid4

from sqlalchemy import select, text

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT / "src"))

from database.session import SessionLocal  # noqa: E402
from modules.foundation.models.security import (  # noqa: E402
    SecRole,
    SecRolePermission,
    SecTenant,
    SecUser,
    SecUserOrgScope,
    SecUserRole,
)
from modules.foundation.service.rbac_service import RBACService  # noqa: E402
from modules.foundation.service.user_service import UserService  # noqa: E402
from modules.master_data.models.employee import MasterEmployee  # noqa: E402
from modules.organization.models.branch import OrgBranch  # noqa: E402
from modules.organization.models.company import OrgCompany  # noqa: E402
from modules.organization.models.hierarchy import OrgDepartment  # noqa: E402
from modules.service.permissions import (  # noqa: E402
    SERVICE_COORDINATOR_PERMISSIONS,
    SERVICE_ENGINEER_PERMISSIONS,
)
from security.password import PasswordHasher  # noqa: E402

DEMO_PASSWORD = "Secure1!"

SERVICE_STAKEHOLDER_PERMISSIONS = [
    "service.request:read",
]

TEAM_SPECS: list[dict] = [
    {
        "email": "service.head@example.com",
        "display_name": "Service Head",
        "role_code": "SERVICE_COORDINATOR",
        "role_name": "Service Coordinator",
        "permissions": SERVICE_COORDINATOR_PERMISSIONS,
        "employee_code": "SVC-HEAD",
        "first_name": "Vikram",
        "last_name": "Desai",
        "designation": "Service Head",
        "mobile_suffix": "9101",
    },
    {
        "email": "service.engineer1@example.com",
        "display_name": "Service Engineer 1",
        "role_code": "SERVICE_ENGINEER",
        "role_name": "Service Engineer",
        "permissions": SERVICE_ENGINEER_PERMISSIONS,
        "employee_code": "SVC-ENG1",
        "first_name": "Anita",
        "last_name": "Rao",
        "designation": "Field Engineer",
        "mobile_suffix": "9102",
    },
    {
        "email": "service.engineer2@example.com",
        "display_name": "Service Engineer 2",
        "role_code": "SERVICE_ENGINEER",
        "role_name": "Service Engineer",
        "permissions": SERVICE_ENGINEER_PERMISSIONS,
        "employee_code": "SVC-ENG2",
        "first_name": "Karan",
        "last_name": "Malhotra",
        "designation": "Support Engineer",
        "mobile_suffix": "9103",
    },
    {
        "email": "service.contact1@example.com",
        "display_name": "Service Contact 1",
        "role_code": "SERVICE_STAKEHOLDER",
        "role_name": "Service Stakeholder",
        "permissions": SERVICE_STAKEHOLDER_PERMISSIONS,
        "employee_code": "SVC-CON1",
        "first_name": "Deepa",
        "last_name": "Nambiar",
        "designation": "Customer Liaison",
        "mobile_suffix": "9104",
        "link_employee": False,
    },
    {
        "email": "service.contact2@example.com",
        "display_name": "Service Contact 2",
        "role_code": "SERVICE_STAKEHOLDER",
        "role_name": "Service Stakeholder",
        "permissions": SERVICE_STAKEHOLDER_PERMISSIONS,
        "employee_code": "SVC-CON2",
        "first_name": "Ravi",
        "last_name": "Krishnan",
        "designation": "Project Coordinator",
        "mobile_suffix": "9105",
        "link_employee": False,
    },
]


def utcnow() -> datetime:
    return datetime.now(timezone.utc)


def load_perm_map(db) -> dict[str, str]:
    rows = db.execute(
        text("SELECT permission_code, id FROM foundation.sec_permission WHERE is_active = true")
    ).all()
    return {str(code): str(pid) for code, pid in rows}


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


def grant_role_permissions(db, tenant_id, role_id, perm_map: dict[str, str], codes: list[str]) -> None:
    for code in dict.fromkeys(codes):
        perm_id = perm_map.get(code)
        if not perm_id:
            continue
        exists = db.scalar(
            select(SecRolePermission).where(
                SecRolePermission.role_id == role_id,
                SecRolePermission.permission_id == perm_id,
            )
        )
        if exists:
            continue
        db.add(
            SecRolePermission(
                id=uuid4(),
                tenant_id=tenant_id,
                role_id=role_id,
                permission_id=perm_id,
                granted_at=utcnow(),
            )
        )
        db.flush()


def ensure_user(db, tenant: SecTenant, email: str, display_name: str) -> SecUser:
    service = UserService(db)
    existing = db.scalar(
        select(SecUser).where(
            SecUser.tenant_id == tenant.id,
            SecUser.email == email,
            SecUser.is_deleted.is_(False),
        )
    )
    if existing:
        existing.password_hash = PasswordHasher.hash_password(DEMO_PASSWORD)
        existing.failed_login_count = 0
        existing.locked_until = None
        if existing.status == "locked":
            existing.status = "active"
        return existing
    created = service.create_user(
        tenant_id=tenant.id,
        email=email,
        password=DEMO_PASSWORD,
        display_name=display_name,
        user_type="employee",
        created_by=None,
    )
    user = db.scalar(select(SecUser).where(SecUser.id == created.id))
    assert user is not None
    return user


def ensure_org_scope(db, tenant_id, user_id, company, branch) -> None:
    scope = db.scalar(
        select(SecUserOrgScope).where(
            SecUserOrgScope.user_id == user_id,
            SecUserOrgScope.company_id == company.id,
        )
    )
    if scope:
        return
    db.add(
        SecUserOrgScope(
            id=uuid4(),
            tenant_id=tenant_id,
            user_id=user_id,
            company_id=company.id,
            branch_id=branch.id,
            is_default=True,
            assigned_at=utcnow(),
            assigned_by=None,
        )
    )


def ensure_employee(
    db,
    *,
    tenant_id,
    company_id,
    branch_id,
    department_id,
    admin_id,
    spec: dict,
    user: SecUser | None,
) -> MasterEmployee | None:
    if spec.get("link_employee", True) is False:
        return None
    emp = db.scalar(
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
            mobile=f"+91-91000-{spec['mobile_suffix']}",
            designation=spec["designation"],
            date_of_joining=date(2024, 6, 1),
            status="active",
            user_id=user.id if user else None,
            created_by=admin_id,
            updated_by=admin_id,
        )
        db.add(emp)
        db.flush()
    else:
        emp.first_name = spec["first_name"]
        emp.last_name = spec["last_name"]
        emp.email = spec["email"]
        emp.designation = spec["designation"]
        emp.status = "active"
        if user:
            emp.user_id = user.id
    if user:
        user.employee_id = emp.id
    return emp


def main() -> None:
    db = SessionLocal()
    try:
        tenant = db.scalar(select(SecTenant).where(SecTenant.tenant_code == "BOOTSTRAP"))
        if tenant is None:
            raise RuntimeError("BOOTSTRAP tenant not found. Run `python -m scripts.seed_demo_data` first.")

        company = db.scalar(
            select(OrgCompany).where(
                OrgCompany.tenant_id == tenant.id,
                OrgCompany.company_code == "DEMOCO",
                OrgCompany.is_deleted.is_(False),
            )
        )
        branch = db.scalar(
            select(OrgBranch).where(
                OrgBranch.company_id == company.id,
                OrgBranch.branch_code == "HQ",
                OrgBranch.is_deleted.is_(False),
            )
        )
        dept = db.scalar(
            select(OrgDepartment).where(
                OrgDepartment.company_id == company.id,
                OrgDepartment.is_deleted.is_(False),
            )
        )
        admin = db.scalar(
            select(SecUser).where(
                SecUser.tenant_id == tenant.id,
                SecUser.email == "admin@example.com",
                SecUser.is_deleted.is_(False),
            )
        )
        if not all([company, branch, dept, admin]):
            raise RuntimeError("Demo org data missing. Run seed_demo_data / seed_demo_modules first.")

        perm_map = load_perm_map(db)
        created_users: list[dict] = []

        for spec in TEAM_SPECS:
            user = ensure_user(db, tenant, spec["email"], spec["display_name"])
            role = ensure_role(db, tenant.id, spec["role_code"], spec["role_name"])
            grant_role_permissions(db, tenant.id, role.id, perm_map, spec["permissions"])

            already = db.scalar(
                select(SecUserRole).where(
                    SecUserRole.user_id == user.id,
                    SecUserRole.role_id == role.id,
                )
            )
            if not already:
                db.add(
                    SecUserRole(
                        id=uuid4(),
                        tenant_id=tenant.id,
                        user_id=user.id,
                        role_id=role.id,
                        assigned_at=utcnow(),
                        assigned_by=admin.id,
                    )
                )

            ensure_org_scope(db, tenant.id, user.id, company, branch)
            emp = ensure_employee(
                db,
                tenant_id=tenant.id,
                company_id=company.id,
                branch_id=branch.id,
                department_id=dept.id,
                admin_id=admin.id,
                spec=spec,
                user=user,
            )
            created_users.append(
                {
                    "email": spec["email"],
                    "password": DEMO_PASSWORD,
                    "role": spec["role_code"],
                    "employee_code": spec.get("employee_code"),
                    "employee_id": str(emp.id) if emp else None,
                }
            )

        db.commit()

        rbac = RBACService(db)
        for spec in TEAM_SPECS:
            user = db.scalar(
                select(SecUser).where(
                    SecUser.tenant_id == tenant.id,
                    SecUser.email == spec["email"],
                    SecUser.is_deleted.is_(False),
                )
            )
            if user:
                rbac.invalidate_user(user.id)

        print("=" * 72)
        print("Service team users seeded")
        print(f"Password for all accounts: {DEMO_PASSWORD}")
        print("-" * 72)
        for row in created_users:
            print(f"  {row['email']}")
            print(f"    Role         : {row['role']}")
            print(f"    Employee     : {row['employee_code'] or '—'} ({row['employee_id'] or 'no employee link'})")
        print("=" * 72)
        print("Sign out and sign in again so permissions reload.")
        print("Assign tickets: login as service.head@example.com -> open ticket -> Assign Owner panel.")
        print("Add contacts on a ticket: owner adds service.contact1@example.com as stakeholder.")
    except Exception:
        db.rollback()
        raise
    finally:
        db.close()


if __name__ == "__main__":
    main()
