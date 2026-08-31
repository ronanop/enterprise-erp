"""Seed one employee login linked to real HRMS workforce data.

Creates/updates:
  - User: employee@example.com
  - Password: {employee_code}+{DOB as DDMMYYYY} when HR profile has date_of_birth,
    else fallback Secure1!
  - Links that user to master_employee EMP-004 (Priya Sharma) from
    seed_hr_workforce so ESS /me, leave, and attendance return real HR data.

Prerequisites:
  - python -m scripts.seed_demo_data
  - python -m scripts.seed_hr_workforce

Usage (from apps/api):
  python -m scripts.seed_ess_employee
"""

from __future__ import annotations

import sys
from datetime import datetime, timezone
from pathlib import Path
from uuid import uuid4

from sqlalchemy import select

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT / "src"))

from database.session import SessionLocal  # noqa: E402
from modules.foundation.models.security import (  # noqa: E402
    SecRole,
    SecTenant,
    SecUser,
    SecUserOrgScope,
    SecUserRole,
)
from modules.foundation.service.user_service import UserService  # noqa: E402
from modules.master_data.models.employee import MasterEmployee  # noqa: E402
from modules.organization.models.branch import OrgBranch  # noqa: E402
from modules.organization.models.company import OrgCompany  # noqa: E402
from modules.hr.models.employee_profile import HrEmployeeProfile  # noqa: E402
from security.ess_default_password import build_ess_default_password  # noqa: E402
from security.password import PasswordHasher  # noqa: E402

DEMO_PASSWORD = "Secure1!"
ESS_EMAIL = "employee@example.com"
# Prefer a workforce employee that has leave balances + attendance history.
ESS_EMPLOYEE_CODE = "EMP-004"
# Fallback if workforce seed was never run.
ESS_FALLBACK_CODES = ("EMP-001", "EMP-002", "EMP-003", "EMP-004", "EMP-005")


def utcnow() -> datetime:
    return datetime.now(timezone.utc)


def main() -> None:
    PasswordHasher.hash_password(DEMO_PASSWORD)
    db = SessionLocal()
    try:
        tenant = db.scalar(select(SecTenant).where(SecTenant.tenant_code == "BOOTSTRAP"))
        if tenant is None:
            raise SystemExit("Bootstrap tenant missing — run seed_demo_data first")

        company = db.scalar(
            select(OrgCompany).where(
                OrgCompany.tenant_id == tenant.id,
                OrgCompany.company_code == "DEMOCO",
                OrgCompany.is_deleted.is_(False),
            )
        )
        branch = db.scalar(
            select(OrgBranch).where(
                OrgBranch.tenant_id == tenant.id,
                OrgBranch.branch_code == "HQ",
                OrgBranch.is_deleted.is_(False),
            )
        )
        if company is None or branch is None:
            raise SystemExit("Demo company/branch missing — run seed_demo_data first")

        admin = db.scalar(
            select(SecUser).where(
                SecUser.tenant_id == tenant.id,
                SecUser.email == "admin@example.com",
                SecUser.is_deleted.is_(False),
            )
        )
        admin_id = admin.id if admin else None

        employee = db.scalar(
            select(MasterEmployee).where(
                MasterEmployee.company_id == company.id,
                MasterEmployee.employee_code == ESS_EMPLOYEE_CODE,
                MasterEmployee.is_deleted.is_(False),
            )
        )
        if employee is None:
            for code in ESS_FALLBACK_CODES:
                employee = db.scalar(
                    select(MasterEmployee).where(
                        MasterEmployee.company_id == company.id,
                        MasterEmployee.employee_code == code,
                        MasterEmployee.is_deleted.is_(False),
                    )
                )
                if employee is not None:
                    break
        if employee is None:
            raise SystemExit(
                "No HRMS employee found — run seed_hr_workforce first "
                f"(expected {ESS_EMPLOYEE_CODE})"
            )

        display_name = f"{employee.first_name} {employee.last_name}".strip() or "Demo Employee"

        profile = db.scalar(
            select(HrEmployeeProfile).where(
                HrEmployeeProfile.employee_id == employee.id,
                HrEmployeeProfile.is_deleted.is_(False),
            )
        )
        login_password = DEMO_PASSWORD
        if profile and profile.date_of_birth:
            try:
                login_password = build_ess_default_password(
                    employee.employee_code, profile.date_of_birth
                )
            except ValueError:
                login_password = DEMO_PASSWORD

        service = UserService(db)
        user = db.scalar(
            select(SecUser).where(
                SecUser.tenant_id == tenant.id,
                SecUser.email == ESS_EMAIL,
                SecUser.is_deleted.is_(False),
            )
        )
        if user is None:
            created = service.create_user(
                tenant_id=tenant.id,
                email=ESS_EMAIL,
                password=login_password,
                display_name=display_name,
                user_type="employee",
                created_by=admin_id,
            )
            user = db.scalar(select(SecUser).where(SecUser.id == created.id))
            assert user is not None
            user.must_change_password = True
        else:
            user.display_name = display_name
            user.user_type = "employee"
            user.password_hash = PasswordHasher.hash_password(login_password)
            user.must_change_password = True
            user.updated_by = admin_id

        role = db.scalar(
            select(SecRole).where(
                SecRole.tenant_id == tenant.id,
                SecRole.role_code == "HR_EMPLOYEE",
                SecRole.is_deleted.is_(False),
            )
        )
        if role is not None:
            already = db.scalar(
                select(SecUserRole).where(
                    SecUserRole.user_id == user.id,
                    SecUserRole.role_id == role.id,
                )
            )
            if not already:
                service.assign_role(
                    tenant_id=tenant.id,
                    user_id=user.id,
                    role_id=role.id,
                    assigned_by=admin_id,
                )

        tenant_admin_role = db.scalar(
            select(SecRole).where(
                SecRole.tenant_id == tenant.id,
                SecRole.role_code == "TENANT_ADMIN",
                SecRole.is_deleted.is_(False),
            )
        )
        if tenant_admin_role is not None:
            stale = db.scalar(
                select(SecUserRole).where(
                    SecUserRole.user_id == user.id,
                    SecUserRole.role_id == tenant_admin_role.id,
                )
            )
            if stale is not None:
                db.delete(stale)

        scope = db.scalar(
            select(SecUserOrgScope).where(
                SecUserOrgScope.user_id == user.id,
                SecUserOrgScope.company_id == company.id,
            )
        )
        if scope is None:
            db.add(
                SecUserOrgScope(
                    id=uuid4(),
                    tenant_id=tenant.id,
                    user_id=user.id,
                    company_id=company.id,
                    branch_id=branch.id,
                    is_default=True,
                    assigned_at=utcnow(),
                    assigned_by=admin_id,
                )
            )

        # Clear this login from any other employee, then map to HRMS record.
        linked_elsewhere = db.scalars(
            select(MasterEmployee).where(
                MasterEmployee.tenant_id == tenant.id,
                MasterEmployee.user_id == user.id,
                MasterEmployee.id != employee.id,
                MasterEmployee.is_deleted.is_(False),
            )
        ).all()
        for other in linked_elsewhere:
            other.user_id = None
            other.updated_by = admin_id

        employee.user_id = user.id
        employee.status = "active"
        employee.updated_by = admin_id

        db.commit()
        print("=" * 60)
        print("ESS employee mapped to HRMS")
        print("=" * 60)
        print(f"Login email   : {ESS_EMAIL}")
        print(f"Password      : {login_password}")
        print("  (Emp{code}@{DDMMYYYY} when HR profile has date_of_birth)")
        print(f"Employee code : {employee.employee_code}")
        print(f"Name          : {display_name}")
        print(f"HRMS email    : {employee.email}")
        print(f"Employee id   : {employee.id}")
        print(f"User id       : {user.id}")
        print("ESS /me, leave, attendance will use this HRMS employee.")
        print("Login in Employee App with the credentials above.")
        print("=" * 60)
    except Exception:
        db.rollback()
        raise
    finally:
        db.close()


if __name__ == "__main__":
    main()
