"""Seed one employee login linked for Employee App (ESS) testing.

Creates/updates:
  - User: employee@example.com / Secure1!
  - Employee: EMP-ESS-001 linked via master_employee.user_id

Prerequisites: run seed_demo_data first (tenant, company, branch).

Usage (from apps/api):
  python -m scripts.seed_ess_employee
"""

from __future__ import annotations

import sys
from datetime import date, datetime, timezone
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
from modules.organization.models.hierarchy import OrgDepartment  # noqa: E402
from security.password import PasswordHasher  # noqa: E402

DEMO_PASSWORD = "Secure1!"
ESS_EMAIL = "employee@example.com"
ESS_EMPLOYEE_CODE = "EMP-ESS-001"


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

        department = db.scalar(
            select(OrgDepartment).where(
                OrgDepartment.company_id == company.id,
                OrgDepartment.is_deleted.is_(False),
            )
        )
        if department is None:
            department = OrgDepartment(
                id=uuid4(),
                tenant_id=tenant.id,
                company_id=company.id,
                branch_id=branch.id,
                department_code="ESS",
                department_name="Employee Self Service",
                status="active",
                created_by=admin_id,
                updated_by=admin_id,
            )
            db.add(department)
            db.flush()

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
                password=DEMO_PASSWORD,
                display_name="Demo Employee",
                user_type="employee",
                created_by=admin_id,
            )
            user = db.scalar(select(SecUser).where(SecUser.id == created.id))
            assert user is not None

        role = db.scalar(
            select(SecRole).where(
                SecRole.tenant_id == tenant.id,
                SecRole.role_code == "TENANT_ADMIN",
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

        employee = db.scalar(
            select(MasterEmployee).where(
                MasterEmployee.company_id == company.id,
                MasterEmployee.employee_code == ESS_EMPLOYEE_CODE,
                MasterEmployee.is_deleted.is_(False),
            )
        )
        if employee is None:
            employee = MasterEmployee(
                id=uuid4(),
                tenant_id=tenant.id,
                company_id=company.id,
                branch_id=branch.id,
                department_id=department.id,
                employee_code=ESS_EMPLOYEE_CODE,
                first_name="Demo",
                last_name="Employee",
                email=ESS_EMAIL,
                mobile="+91-90000-99999",
                designation="Staff",
                date_of_joining=date(2024, 4, 1),
                status="active",
                user_id=user.id,
                created_by=admin_id,
                updated_by=admin_id,
            )
            db.add(employee)
        else:
            employee.user_id = user.id
            employee.status = "active"
            employee.updated_by = admin_id

        db.commit()
        print("=" * 60)
        print("ESS employee seeded")
        print("=" * 60)
        print(f"Email         : {ESS_EMAIL}")
        print(f"Password      : {DEMO_PASSWORD}")
        print(f"Employee code : {ESS_EMPLOYEE_CODE}")
        print(f"Employee id   : {employee.id}")
        print(f"User id       : {user.id}")
        print("Use these credentials in Employee App (http://localhost:3001)")
        print("=" * 60)
    except Exception:
        db.rollback()
        raise
    finally:
        db.close()


if __name__ == "__main__":
    main()
