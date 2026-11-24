"""Seed ESS login for real HRMS employee CT5263 (Rishabh Gaur).

Sets demo password Secure1!, ensures HR_EMPLOYEE role + org scope,
and keeps employee ↔ sec_user linkage for the employee app.

Usage (inside erp-api container):
  python -m scripts.seed_ess_rishabh_gaur
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
    SecUser,
    SecUserOrgScope,
    SecUserRole,
)
from modules.foundation.service.user_service import UserService  # noqa: E402
from modules.master_data.models.employee import MasterEmployee  # noqa: E402
from modules.organization.models.branch import OrgBranch  # noqa: E402
from modules.organization.models.company import OrgCompany  # noqa: E402
from security.password import PasswordHasher  # noqa: E402

DEMO_PASSWORD = "Secure1!"
EMPLOYEE_CODE = "CT5263"
LOGIN_EMAIL = "rishabh.gaur@cachedigitech.com"


def utcnow() -> datetime:
    return datetime.now(timezone.utc)


def main() -> None:
    PasswordHasher.hash_password(DEMO_PASSWORD, validate=False)
    db = SessionLocal()
    try:
        employee = db.scalar(
            select(MasterEmployee).where(
                MasterEmployee.employee_code == EMPLOYEE_CODE,
                MasterEmployee.is_deleted.is_(False),
            )
        )
        if employee is None:
            raise SystemExit(f"Employee {EMPLOYEE_CODE} not found in HRMS")

        company = db.get(OrgCompany, employee.company_id)
        if company is None or company.is_deleted:
            raise SystemExit("Company missing for employee")

        branch = db.scalar(
            select(OrgBranch).where(
                OrgBranch.company_id == company.id,
                OrgBranch.is_deleted.is_(False),
            )
        )
        if branch is None:
            raise SystemExit(f"No branch for company {company.company_code}")

        display_name = f"{employee.first_name} {employee.last_name}".strip()
        service = UserService(db)

        user = None
        if employee.user_id:
            user = db.get(SecUser, employee.user_id)
            if user is not None and user.is_deleted:
                user = None

        if user is None:
            user = db.scalar(
                select(SecUser).where(
                    SecUser.tenant_id == employee.tenant_id,
                    SecUser.email == LOGIN_EMAIL,
                    SecUser.is_deleted.is_(False),
                )
            )

        if user is None:
            created = service.create_user(
                tenant_id=employee.tenant_id,
                email=LOGIN_EMAIL,
                password=DEMO_PASSWORD,
                display_name=display_name,
                user_type="employee",
                created_by=None,
            )
            user = db.scalar(select(SecUser).where(SecUser.id == created.id))
            assert user is not None
        else:
            user.display_name = display_name
            user.user_type = "employee"
            user.password_hash = PasswordHasher.hash_password(
                DEMO_PASSWORD, validate=False
            )
            user.updated_by = None

        user.status = "active"
        user.must_change_password = False
        user.failed_login_count = 0
        user.locked_until = None
        user.employee_id = employee.id
        user.mfa_enabled = False

        role = db.scalar(
            select(SecRole).where(
                SecRole.tenant_id == employee.tenant_id,
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
                    tenant_id=employee.tenant_id,
                    user_id=user.id,
                    role_id=role.id,
                    assigned_by=None,
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
                    tenant_id=employee.tenant_id,
                    user_id=user.id,
                    company_id=company.id,
                    branch_id=branch.id,
                    is_default=True,
                    assigned_at=utcnow(),
                    assigned_by=None,
                )
            )

        # Keep a single login ↔ employee mapping.
        linked_elsewhere = db.scalars(
            select(MasterEmployee).where(
                MasterEmployee.tenant_id == employee.tenant_id,
                MasterEmployee.user_id == user.id,
                MasterEmployee.id != employee.id,
                MasterEmployee.is_deleted.is_(False),
            )
        ).all()
        for other in linked_elsewhere:
            other.user_id = None

        employee.user_id = user.id
        employee.status = "active"

        db.commit()
        print("=" * 60)
        print("ESS login ready — Rishabh Gaur")
        print("=" * 60)
        print(f"Company code  : {company.company_code}")
        print(f"Employee code : {employee.employee_code}")
        print(f"Name          : {display_name}")
        print(f"Login email   : {user.email}")
        print(f"Password      : {DEMO_PASSWORD}")
        print(f"Employee id   : {employee.id}")
        print(f"User id       : {user.id}")
        print("Use these in employee-app-by-Rishabh login.")
        print("=" * 60)
    except Exception:
        db.rollback()
        raise
    finally:
        db.close()


if __name__ == "__main__":
    main()
