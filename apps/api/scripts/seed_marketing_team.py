"""Seed marketing-module demo team with workflow roles.

Usage (from apps/api):
  .venv\\Scripts\\python.exe -m scripts.seed_marketing_team
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
from modules.marketing.permissions import (  # noqa: E402
    MARKETING_BUSINESS_OWNER_PERMISSIONS,
    MARKETING_CAMPAIGN_HANDLER_PERMISSIONS,
    MARKETING_CREATOR_PERMISSIONS,
    MARKETING_LINKEDIN_HANDLER_PERMISSIONS,
    MARKETING_MANAGER_PERMISSIONS,
    MARKETING_PUBLISHER_PERMISSIONS,
    MARKETING_VIDEO_EDITOR_PERMISSIONS,
)
from modules.master_data.models.employee import MasterEmployee  # noqa: E402
from modules.organization.models.branch import OrgBranch  # noqa: E402
from modules.organization.models.company import OrgCompany  # noqa: E402
from modules.organization.models.hierarchy import OrgDepartment  # noqa: E402
from security.password import PasswordHasher  # noqa: E402

DEMO_PASSWORD = "Secure1!"

TEAM_SPECS: list[dict] = [
    {
        "email": "marketing.head@example.com",
        "display_name": "Marketing Head",
        "role_code": "MARKETING_HEAD_DEMO",
        "role_name": "Marketing Head (Demo)",
        "permissions": MARKETING_MANAGER_PERMISSIONS,
        "employee_code": "MKT-HEAD",
        "first_name": "Priya",
        "last_name": "Sharma",
        "designation": "Marketing Head",
        "mobile_suffix": "9201",
        "workflow": "Final approval after all verifiers complete checklist",
    },
    {
        "email": "marketing.businessowner@example.com",
        "display_name": "Business Owner",
        "role_code": "MARKETING_BUSINESS_OWNER",
        "role_name": "Business Owner",
        "permissions": MARKETING_BUSINESS_OWNER_PERMISSIONS,
        "employee_code": "MKT-BO1",
        "first_name": "Suresh",
        "last_name": "Menon",
        "designation": "Business Owner",
        "mobile_suffix": "9207",
        "workflow": "After marketing head approves draft — approve, reject, or send feedback to head before LinkedIn final draft",
    },
    {
        "email": "marketing.campaign@example.com",
        "display_name": "Campaign & Social Media Handler",
        "role_code": "MARKETING_CAMPAIGN_HANDLER",
        "role_name": "Campaign & Social Media Handler",
        "permissions": MARKETING_CAMPAIGN_HANDLER_PERMISSIONS,
        "employee_code": "MKT-CMP1",
        "first_name": "Kavita",
        "last_name": "Nair",
        "designation": "Campaign & Social Media Manager",
        "mobile_suffix": "9202",
        "workflow": "Verify copy, theme, hashtags · first verifier after creator",
    },
    {
        "email": "marketing.publisher@example.com",
        "display_name": "Publisher",
        "role_code": "MARKETING_PUBLISHER_DEMO",
        "role_name": "Publisher (Demo)",
        "permissions": MARKETING_PUBLISHER_PERMISSIONS,
        "employee_code": "MKT-PUB1",
        "first_name": "Vivek",
        "last_name": "Patel",
        "designation": "Publishing Coordinator",
        "mobile_suffix": "9203",
        "workflow": "Verify before head · publish only after final head approval",
    },
    {
        "email": "marketing.creator@example.com",
        "display_name": "Content Creator",
        "role_code": "MARKETING_CREATOR_DEMO",
        "role_name": "Content Creator (Demo)",
        "permissions": MARKETING_CREATOR_PERMISSIONS,
        "employee_code": "MKT-CRT1",
        "first_name": "Rohan",
        "last_name": "Mehta",
        "designation": "Content Writer",
        "mobile_suffix": "9204",
        "workflow": "Draft content · upload assets · submit for verification",
    },
    {
        "email": "marketing.linkedin@example.com",
        "display_name": "LinkedIn Handler",
        "role_code": "MARKETING_LINKEDIN_HANDLER",
        "role_name": "LinkedIn Handler",
        "permissions": MARKETING_LINKEDIN_HANDLER_PERMISSIONS,
        "employee_code": "MKT-LI1",
        "first_name": "Neha",
        "last_name": "Iyer",
        "designation": "Social Media — LinkedIn",
        "mobile_suffix": "9205",
        "workflow": "Draft LinkedIn posts · send to marketing head for approval",
    },
    {
        "email": "marketing.video@example.com",
        "display_name": "Video Editor",
        "role_code": "MARKETING_VIDEO_EDITOR",
        "role_name": "Video Editor",
        "permissions": MARKETING_VIDEO_EDITOR_PERMISSIONS,
        "employee_code": "MKT-VID1",
        "first_name": "Amit",
        "last_name": "Desai",
        "designation": "Video Editor",
        "mobile_suffix": "9206",
        "workflow": "Upload & verify video quality, resolution, captions, audio",
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
        role.role_name = role_name
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
    seen: set[str] = set()
    for code in codes:
        if code in seen:
            continue
        seen.add(code)
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
        existing.display_name = display_name
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


def ensure_employee(db, *, tenant_id, company_id, branch_id, department_id, admin_id, spec: dict, user: SecUser):
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
            mobile=f"+91-92000-{spec['mobile_suffix']}",
            designation=spec["designation"],
            date_of_joining=date(2024, 8, 1),
            status="active",
            user_id=user.id,
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
        emp.user_id = user.id
    user.employee_id = emp.id
    return emp


def main() -> None:
    db = SessionLocal()
    try:
        tenant = db.scalar(select(SecTenant).where(SecTenant.tenant_code == "BOOTSTRAP"))
        if tenant is None:
            raise RuntimeError("BOOTSTRAP tenant not found. Run seed_demo_data first.")

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
            raise RuntimeError("Demo org data missing.")

        perm_map = load_perm_map(db)
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
            ensure_employee(
                db,
                tenant_id=tenant.id,
                company_id=company.id,
                branch_id=branch.id,
                department_id=dept.id,
                admin_id=admin.id,
                spec=spec,
                user=user,
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
        print("Marketing team users seeded (7 roles)")
        print(f"Password for all accounts: {DEMO_PASSWORD}")
        print("-" * 72)
        for spec in TEAM_SPECS:
            print(f"  {spec['email']}")
            print(f"    Role     : {spec['display_name']}")
            print(f"    Workflow : {spec['workflow']}")
        print("=" * 72)
        print(
            "Workflow: Creator -> Campaign -> Marketing Head -> Business Owner -> "
            "LinkedIn Handler (final draft) -> Marketing Head -> Publisher"
        )
    except Exception:
        db.rollback()
        raise
    finally:
        db.close()


if __name__ == "__main__":
    main()
