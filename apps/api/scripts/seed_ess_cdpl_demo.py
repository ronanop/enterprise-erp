"""Seed CDPL ESS demo manager + employee for phone login.

Creates/updates under company CDPL:
  Manager  ESSMGR01  mobile 9000000001  password Secure1!
  Employee ESSEMP01  mobile 9000000002  password Secure1!
             reports to ESSMGR01, DOB-based password also accepted

Usage (inside erp-api container):
  python -m scripts.seed_ess_cdpl_demo
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
    SecUser,
    SecUserOrgScope,
    SecUserRole,
)
from modules.foundation.service.user_service import UserService  # noqa: E402
from modules.hr.models.employee_profile import HrEmployeeProfile  # noqa: E402
from modules.master_data.models.employee import MasterEmployee  # noqa: E402
from modules.organization.models.branch import OrgBranch  # noqa: E402
from modules.organization.models.company import OrgCompany  # noqa: E402
from modules.organization.models.hierarchy import OrgDepartment  # noqa: E402
from security.ess_default_password import build_ess_default_password  # noqa: E402
from security.password import PasswordHasher  # noqa: E402

DEMO_PASSWORD = "Secure1!"
COMPANY_CODE = "CDPL"

PEOPLE = (
    {
        "employee_code": "ESSMGR01",
        "first_name": "Demo",
        "last_name": "Manager",
        "email": "ess.manager@cdpl.demo",
        "mobile": "9000000001",
        "designation": "Engineering Manager",
        "is_manager": True,
        "dob": date(1990, 1, 15),
        "manager_code": None,
    },
    {
        "employee_code": "ESSEMP01",
        "first_name": "Demo",
        "last_name": "Employee",
        "email": "ess.employee@cdpl.demo",
        "mobile": "9000000002",
        "designation": "Software Engineer",
        "is_manager": False,
        "dob": date(1995, 6, 15),
        "manager_code": "ESSMGR01",
    },
)


def utcnow() -> datetime:
    return datetime.now(timezone.utc)


def ensure_user(
    db,
    *,
    tenant_id,
    company_id,
    branch_id,
    admin_id,
    email: str,
    display_name: str,
    password: str,
) -> SecUser:
    service = UserService(db)
    user = db.scalar(
        select(SecUser).where(
            SecUser.tenant_id == tenant_id,
            SecUser.email == email,
            SecUser.is_deleted.is_(False),
        )
    )
    if user is None:
        created = service.create_user(
            tenant_id=tenant_id,
            email=email,
            password=password,
            display_name=display_name,
            user_type="employee",
            created_by=admin_id,
        )
        user = db.scalar(select(SecUser).where(SecUser.id == created.id))
        assert user is not None
    else:
        user.display_name = display_name
        user.user_type = "employee"
        user.password_hash = PasswordHasher.hash_password(password, validate=False)
        user.failed_login_count = 0
        user.locked_until = None
        if user.status in {"locked", "inactive"}:
            user.status = "active"
        user.updated_by = admin_id

    for role_code in ("HR_EMPLOYEE", "TENANT_ADMIN"):
        role = db.scalar(
            select(SecRole).where(
                SecRole.tenant_id == tenant_id,
                SecRole.role_code == role_code,
                SecRole.is_deleted.is_(False),
            )
        )
        if role is None:
            continue
        already = db.scalar(
            select(SecUserRole).where(
                SecUserRole.user_id == user.id,
                SecUserRole.role_id == role.id,
            )
        )
        if not already:
            service.assign_role(
                tenant_id=tenant_id,
                user_id=user.id,
                role_id=role.id,
                assigned_by=admin_id,
            )

    scope = db.scalar(
        select(SecUserOrgScope).where(
            SecUserOrgScope.user_id == user.id,
            SecUserOrgScope.company_id == company_id,
        )
    )
    if scope is None:
        db.add(
            SecUserOrgScope(
                id=uuid4(),
                tenant_id=tenant_id,
                user_id=user.id,
                company_id=company_id,
                branch_id=branch_id,
                is_default=True,
                assigned_at=utcnow(),
                assigned_by=admin_id,
            )
        )
    return user


def main() -> None:
    PasswordHasher.hash_password(DEMO_PASSWORD, validate=False)
    db = SessionLocal()
    try:
        company = db.scalar(
            select(OrgCompany).where(
                OrgCompany.company_code == COMPANY_CODE,
                OrgCompany.is_deleted.is_(False),
            )
        )
        if company is None:
            raise SystemExit(f"Company {COMPANY_CODE} not found")

        branch = db.scalar(
            select(OrgBranch).where(
                OrgBranch.company_id == company.id,
                OrgBranch.is_deleted.is_(False),
            )
        )
        if branch is None:
            raise SystemExit(f"No branch for {COMPANY_CODE}")

        department = db.scalar(
            select(OrgDepartment).where(
                OrgDepartment.company_id == company.id,
                OrgDepartment.department_code.in_(("HR", "DEPT-HR", "DEPT-TECHNICAL")),
                OrgDepartment.is_deleted.is_(False),
            )
        ) or db.scalar(
            select(OrgDepartment).where(
                OrgDepartment.company_id == company.id,
                OrgDepartment.is_deleted.is_(False),
            )
        )
        if department is None:
            raise SystemExit(f"No department for {COMPANY_CODE}")

        admin = db.scalar(
            select(SecUser).where(
                SecUser.tenant_id == company.tenant_id,
                SecUser.email == "admin@example.com",
                SecUser.is_deleted.is_(False),
            )
        )
        admin_id = admin.id if admin else None
        tenant_id = company.tenant_id

        by_code: dict[str, MasterEmployee] = {}

        for person in PEOPLE:
            display = f"{person['first_name']} {person['last_name']}"
            user = ensure_user(
                db,
                tenant_id=tenant_id,
                company_id=company.id,
                branch_id=branch.id,
                admin_id=admin_id,
                email=person["email"],
                display_name=display,
                password=DEMO_PASSWORD,
            )

            employee = db.scalar(
                select(MasterEmployee).where(
                    MasterEmployee.company_id == company.id,
                    MasterEmployee.employee_code == person["employee_code"],
                    MasterEmployee.is_deleted.is_(False),
                )
            )
            if employee is None:
                employee = MasterEmployee(
                    id=uuid4(),
                    tenant_id=tenant_id,
                    company_id=company.id,
                    branch_id=branch.id,
                    department_id=department.id,
                    employee_code=person["employee_code"],
                    first_name=person["first_name"],
                    last_name=person["last_name"],
                    email=person["email"],
                    mobile=person["mobile"],
                    designation=person["designation"],
                    date_of_joining=date(2024, 1, 1),
                    status="active",
                    user_id=user.id,
                    is_manager=person["is_manager"],
                    created_by=admin_id,
                    updated_by=admin_id,
                )
                db.add(employee)
                db.flush()
            else:
                employee.first_name = person["first_name"]
                employee.last_name = person["last_name"]
                employee.email = person["email"]
                employee.mobile = person["mobile"]
                employee.designation = person["designation"]
                employee.status = "active"
                employee.user_id = user.id
                employee.is_manager = person["is_manager"]
                employee.department_id = department.id
                employee.branch_id = branch.id
                employee.updated_by = admin_id
                db.flush()

            profile = db.scalar(
                select(HrEmployeeProfile).where(
                    HrEmployeeProfile.employee_id == employee.id,
                    HrEmployeeProfile.is_deleted.is_(False),
                )
            )
            if profile is None:
                profile = HrEmployeeProfile(
                    id=uuid4(),
                    tenant_id=tenant_id,
                    company_id=company.id,
                    branch_id=branch.id,
                    employee_id=employee.id,
                    date_of_birth=person["dob"],
                    gender="other",
                    status="active",
                    created_by=admin_id,
                    updated_by=admin_id,
                )
                db.add(profile)
            else:
                profile.date_of_birth = person["dob"]
                profile.status = "active"
                profile.updated_by = admin_id

            by_code[person["employee_code"]] = employee

        for person in PEOPLE:
            mgr_code = person["manager_code"]
            employee = by_code[person["employee_code"]]
            if mgr_code and mgr_code in by_code:
                employee.reporting_manager_id = by_code[mgr_code].id
            else:
                employee.reporting_manager_id = None

        db.commit()

        print("=" * 60)
        print("CDPL ESS demo users ready")
        print("=" * 60)
        print(f"Company : {COMPANY_CODE}")
        for person in PEOPLE:
            dob_pw = build_ess_default_password(person["employee_code"], person["dob"])
            role = "Manager" if person["is_manager"] else "Employee"
            print(f"\n{role}")
            print(f"  Mobile        : {person['mobile']}")
            print(f"  Employee code : {person['employee_code']}")
            print(f"  Password      : {DEMO_PASSWORD}")
            print(f"  DOB password  : {dob_pw}")
        print("\nLogin steps: company CDPL → mobile → captcha → code + password")
        print("=" * 60)
    except Exception:
        db.rollback()
        raise
    finally:
        db.close()


if __name__ == "__main__":
    main()
