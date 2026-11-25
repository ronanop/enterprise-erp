"""Seed App Store / Play Store ESS review accounts + punch/leave-ready data.

Creates (idempotent):
  - Tenant BOOTSTRAP (if missing)
  - Company code **CDPL0112** (matches employee-app ESS_COMPANY_CODE)
  - Branch HQ + soft attendance rule (no geofence / selfie / face)
  - Leave types CL/SL/EL + balances
  - 2 review logins (employee + manager) with stable passwords
  - Sample attendance history for the employee
  - Manager ↔ employee reporting link

Usage (from apps/api, after alembic upgrade head):
  .venv\\Scripts\\python.exe -m scripts.seed_store_review

Env (optional):
  ESS_STORE_REVIEW_MODE=true  → API also relaxes punch gates at runtime
"""

from __future__ import annotations

import sys
from datetime import date, datetime, timedelta, timezone
from decimal import Decimal
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
from modules.hr.models.attendance import HrAttendance  # noqa: E402
from modules.hr.models.attendance_rule import HrAttendanceRule  # noqa: E402
from modules.hr.models.employee_profile import HrEmployeeProfile  # noqa: E402
from modules.hr.models.employment import HrEmployment  # noqa: E402
from modules.hr.models.leave_balance import HrLeaveBalance  # noqa: E402
from modules.hr.models.leave_type import HrLeaveType  # noqa: E402
from modules.master_data.models.employee import MasterEmployee  # noqa: E402
from modules.organization.models.branch import OrgBranch  # noqa: E402
from modules.organization.models.company import OrgCompany  # noqa: E402
from modules.organization.models.hierarchy import OrgDepartment  # noqa: E402
from security.password import PasswordHasher  # noqa: E402

# --- Fixed store-review credentials (also documented in STORE_REVIEW_STAGING.md) ---
# Reviewers type portal code CDPL0112; auth aliases it to ERP company_code CDPL.
PORTAL_COMPANY_CODE = "CDPL0112"
COMPANY_CODE = "CDPL"
COMPANY_NAME = "iConnect Plus Demo Co"
REVIEW_PASSWORD = "Review@2026"
BALANCE_YEAR = date.today().year

# email, emp_code, first, last, dob, is_manager
PEOPLE = [
    (
        "review.employee@iconnectplus.in",
        "REV001",
        "Asha",
        "Verma",
        date(1990, 1, 15),
        False,
    ),
    (
        "review.manager@iconnectplus.in",
        "RVM001",
        "Rohan",
        "Mehta",
        date(1985, 6, 20),
        True,
    ),
]


def utcnow() -> datetime:
    return datetime.now(timezone.utc)


def ensure_tenant(db) -> SecTenant:
    tenant = db.scalar(select(SecTenant).where(SecTenant.tenant_code == "BOOTSTRAP"))
    if tenant:
        return tenant
    tenant = SecTenant(
        id=uuid4(),
        tenant_code="BOOTSTRAP",
        tenant_name="Store Review Tenant",
        status="active",
        timezone="Asia/Kolkata",
        locale="en",
    )
    db.add(tenant)
    db.flush()
    return tenant


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


def ensure_company_branch_dept(
    db, tenant: SecTenant, admin_id
) -> tuple[OrgCompany, OrgBranch, OrgDepartment]:
    company = db.scalar(
        select(OrgCompany).where(
            OrgCompany.tenant_id == tenant.id,
            OrgCompany.company_code == COMPANY_CODE,
            OrgCompany.is_deleted.is_(False),
        )
    )
    # Older store-review seeds used portal code as org code; auth aliases CDPL0112→CDPL.
    if company is None:
        legacy = db.scalar(
            select(OrgCompany).where(
                OrgCompany.tenant_id == tenant.id,
                OrgCompany.company_code == PORTAL_COMPANY_CODE,
                OrgCompany.is_deleted.is_(False),
            )
        )
        if legacy is not None:
            legacy.company_code = COMPANY_CODE
            legacy.updated_by = admin_id
            company = legacy
            db.flush()
    if company is None:
        company = OrgCompany(
            id=uuid4(),
            tenant_id=tenant.id,
            company_code=COMPANY_CODE,
            company_name=COMPANY_NAME,
            legal_name=COMPANY_NAME,
            country_code="IN",
            currency_code="INR",
            registration_number="CIN-STORE-REVIEW",
            tax_number="GSTIN-STORE-REVIEW",
            fiscal_year_start_month=4,
            timezone="Asia/Kolkata",
            status="active",
            created_by=admin_id,
            updated_by=admin_id,
        )
        db.add(company)
        db.flush()

    branch = db.scalar(
        select(OrgBranch).where(
            OrgBranch.tenant_id == tenant.id,
            OrgBranch.company_id == company.id,
            OrgBranch.branch_code == "HQ",
            OrgBranch.is_deleted.is_(False),
        )
    )
    if branch is None:
        branch = OrgBranch(
            id=uuid4(),
            tenant_id=tenant.id,
            company_id=company.id,
            branch_code="HQ",
            branch_name="Head Office",
            branch_type="head_office",
            status="active",
            created_by=admin_id,
            updated_by=admin_id,
        )
        db.add(branch)
        db.flush()

    dept = db.scalar(
        select(OrgDepartment).where(
            OrgDepartment.company_id == company.id,
            OrgDepartment.department_code == "OPS",
            OrgDepartment.is_deleted.is_(False),
        )
    )
    if dept is None:
        dept = OrgDepartment(
            id=uuid4(),
            tenant_id=tenant.id,
            company_id=company.id,
            branch_id=branch.id,
            department_code="OPS",
            department_name="Operations",
            status="active",
            created_by=admin_id,
            updated_by=admin_id,
        )
        db.add(dept)
        db.flush()
    return company, branch, dept


def ensure_attendance_rule(db, tenant, company, branch, admin_id) -> None:
    rule = db.scalar(
        select(HrAttendanceRule).where(
            HrAttendanceRule.tenant_id == tenant.id,
            HrAttendanceRule.company_id == company.id,
            HrAttendanceRule.rule_code == "STORE-REVIEW",
            HrAttendanceRule.is_deleted.is_(False),
        )
    )
    if rule is None:
        rule = HrAttendanceRule(
            id=uuid4(),
            tenant_id=tenant.id,
            company_id=company.id,
            branch_id=branch.id,
            rule_code="STORE-REVIEW",
            rule_name="Store Review Soft Punch",
            geofence_required=False,
            ess_selfie_required=False,
            ess_face_at_punch_required=False,
            is_default=True,
            status="active",
            created_by=admin_id,
            updated_by=admin_id,
        )
        db.add(rule)
        db.flush()
    else:
        rule.geofence_required = False
        rule.ess_selfie_required = False
        rule.ess_face_at_punch_required = False
        rule.is_default = True
        rule.status = "active"
        # Soft-delete other defaults so this one wins
    others = db.scalars(
        select(HrAttendanceRule).where(
            HrAttendanceRule.company_id == company.id,
            HrAttendanceRule.id != rule.id,
            HrAttendanceRule.is_deleted.is_(False),
            HrAttendanceRule.is_default.is_(True),
        )
    ).all()
    for o in others:
        o.is_default = False


def ensure_leave_types(db, tenant, company, branch, admin_id) -> dict[str, HrLeaveType]:
    out: dict[str, HrLeaveType] = {}
    for code, name, days in (
        ("CL", "Casual Leave", Decimal("12")),
        ("SL", "Sick Leave", Decimal("12")),
        ("EL", "Earned Leave", Decimal("15")),
    ):
        row = db.scalar(
            select(HrLeaveType).where(
                HrLeaveType.company_id == company.id,
                HrLeaveType.leave_type_code == code,
                HrLeaveType.is_deleted.is_(False),
            )
        )
        if row is None:
            row = HrLeaveType(
                id=uuid4(),
                tenant_id=tenant.id,
                company_id=company.id,
                branch_id=branch.id,
                leave_type_code=code,
                leave_type_name=name,
                is_paid=True,
                max_days_per_year=days,
                status="active",
                created_by=admin_id,
                updated_by=admin_id,
            )
            db.add(row)
            db.flush()
        out[code] = row
    return out


def upsert_person(
    db,
    *,
    tenant: SecTenant,
    company: OrgCompany,
    branch: OrgBranch,
    department: OrgDepartment,
    admin_id,
    email: str,
    emp_code: str,
    first: str,
    last: str,
    dob: date,
    is_manager: bool,
    manager_employee: MasterEmployee | None,
    leave_types: dict[str, HrLeaveType],
    password_hash: str,
) -> MasterEmployee:
    service = UserService(db)
    role = ensure_role(
        db,
        tenant.id,
        "HR_MANAGER" if is_manager else "HR_EMPLOYEE",
        "HR Manager" if is_manager else "HR Employee",
    )

    user = db.scalar(
        select(SecUser).where(
            SecUser.tenant_id == tenant.id,
            SecUser.email == email,
            SecUser.is_deleted.is_(False),
        )
    )
    display = f"{first} {last}"
    if user is None:
        created = service.create_user(
            tenant_id=tenant.id,
            email=email,
            password=REVIEW_PASSWORD,
            display_name=display,
            user_type="employee",
            created_by=admin_id,
        )
        user = db.scalar(select(SecUser).where(SecUser.id == created.id))
        assert user is not None
    user.password_hash = password_hash
    user.must_change_password = False
    user.failed_login_count = 0
    user.locked_until = None
    user.status = "active"
    user.display_name = display
    user.user_type = "employee"

    already = db.scalar(
        select(SecUserRole).where(SecUserRole.user_id == user.id, SecUserRole.role_id == role.id)
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

    emp = db.scalar(
        select(MasterEmployee).where(
            MasterEmployee.company_id == company.id,
            MasterEmployee.employee_code == emp_code,
            MasterEmployee.is_deleted.is_(False),
        )
    )
    mobile = f"+9198{emp_code[-4:].zfill(4)}10001"[:15]
    designation = "Engineering Manager" if is_manager else "Software Engineer"
    doj = date(2022, 4, 1)
    if emp is None:
        emp = MasterEmployee(
            id=uuid4(),
            tenant_id=tenant.id,
            company_id=company.id,
            branch_id=branch.id,
            department_id=department.id,
            employee_code=emp_code,
            first_name=first,
            last_name=last,
            email=email,
            mobile=mobile,
            designation=designation,
            date_of_joining=doj,
            status="active",
            user_id=user.id,
            reporting_manager_id=manager_employee.id if manager_employee else None,
            is_manager=is_manager,
            created_by=admin_id,
            updated_by=admin_id,
        )
        db.add(emp)
        db.flush()
    else:
        emp.first_name = first
        emp.last_name = last
        emp.email = email
        emp.mobile = mobile
        emp.designation = designation
        emp.department_id = department.id
        emp.user_id = user.id
        emp.status = "active"
        emp.branch_id = branch.id
        emp.reporting_manager_id = manager_employee.id if manager_employee else None
        emp.is_manager = is_manager
        emp.updated_by = admin_id

    # Keep both sides of the link — ESS resolve_employee uses master_employee.user_id;
    # auth/session surfaces often use sec_user.employee_id.
    user.employee_id = emp.id

    profile = db.scalar(
        select(HrEmployeeProfile).where(
            HrEmployeeProfile.employee_id == emp.id,
            HrEmployeeProfile.is_deleted.is_(False),
        )
    )
    if profile is None:
        profile = HrEmployeeProfile(
            id=uuid4(),
            tenant_id=tenant.id,
            company_id=company.id,
            branch_id=branch.id,
            employee_id=emp.id,
            date_of_birth=dob,
            gender="female" if first == "Asha" else "male",
            face_auth_enabled=False,
            face_auth_fingerprint=None,
            status="active",
            created_by=admin_id,
            updated_by=admin_id,
        )
        db.add(profile)
    else:
        profile.date_of_birth = dob
        profile.face_auth_enabled = False
        profile.face_auth_fingerprint = None
        profile.status = "active"

    employment = db.scalar(
        select(HrEmployment).where(
            HrEmployment.employee_id == emp.id,
            HrEmployment.is_deleted.is_(False),
        )
    )
    if employment is None:
        db.add(
            HrEmployment(
                id=uuid4(),
                tenant_id=tenant.id,
                company_id=company.id,
                branch_id=branch.id,
                employee_id=emp.id,
                document_number=f"EMP-{emp_code}",
                date_of_joining=doj,
                employment_type="permanent",
                status="active",
                created_by=admin_id,
                updated_by=admin_id,
            )
        )

    for _code, ltype in leave_types.items():
        bal = db.scalar(
            select(HrLeaveBalance).where(
                HrLeaveBalance.employee_id == emp.id,
                HrLeaveBalance.leave_type_id == ltype.id,
                HrLeaveBalance.balance_year == BALANCE_YEAR,
                HrLeaveBalance.is_deleted.is_(False),
            )
        )
        opening = Decimal("12.00") if ltype.leave_type_code != "EL" else Decimal("15.00")
        if bal is None:
            db.add(
                HrLeaveBalance(
                    id=uuid4(),
                    tenant_id=tenant.id,
                    company_id=company.id,
                    branch_id=branch.id,
                    employee_id=emp.id,
                    leave_type_id=ltype.id,
                    balance_year=BALANCE_YEAR,
                    opening_balance=opening,
                    accrued=Decimal("0"),
                    used=Decimal("1.00"),
                    closing_balance=opening - Decimal("1.00"),
                    status="open",
                    created_by=admin_id,
                    updated_by=admin_id,
                )
            )
        else:
            bal.opening_balance = opening
            bal.closing_balance = opening - bal.used
            bal.status = "open"

    return emp


def seed_attendance_history(db, tenant, company, branch, emp: MasterEmployee, admin_id) -> None:
    today = date.today()
    for days_ago in (1, 2, 3, 5):
        d = today - timedelta(days=days_ago)
        if d.weekday() >= 5:
            continue
        existing = db.scalar(
            select(HrAttendance).where(
                HrAttendance.employee_id == emp.id,
                HrAttendance.attendance_date == d,
                HrAttendance.is_deleted.is_(False),
            )
        )
        if existing:
            continue
        check_in = datetime(d.year, d.month, d.day, 9, 35, tzinfo=timezone.utc)
        check_out = datetime(d.year, d.month, d.day, 18, 10, tzinfo=timezone.utc)
        db.add(
            HrAttendance(
                id=uuid4(),
                tenant_id=tenant.id,
                company_id=company.id,
                branch_id=branch.id,
                employee_id=emp.id,
                attendance_date=d,
                check_in_at=check_in,
                check_out_at=check_out,
                total_hours=Decimal("8.50"),
                attendance_status="present",
                source="mobile",
                status="recorded",
                notes="Store-review seed",
                created_by=admin_id,
                updated_by=admin_id,
            )
        )


def main() -> None:
    password_hash = PasswordHasher.hash_password(REVIEW_PASSWORD)
    db = SessionLocal()
    try:
        tenant = ensure_tenant(db)
        ensure_role(db, tenant.id, "SUPER_ADMIN", "Super Admin")
        ensure_role(db, tenant.id, "TENANT_ADMIN", "Tenant Admin")
        ensure_role(db, tenant.id, "HR_EMPLOYEE", "HR Employee")
        ensure_role(db, tenant.id, "HR_MANAGER", "HR Manager")

        admin = db.scalar(
            select(SecUser).where(
                SecUser.tenant_id == tenant.id,
                SecUser.email == "admin@example.com",
                SecUser.is_deleted.is_(False),
            )
        )
        if admin is None:
            created = UserService(db).create_user(
                tenant_id=tenant.id,
                email="admin@example.com",
                password=REVIEW_PASSWORD,
                display_name="Store Review Admin",
                user_type="internal",
                created_by=None,
            )
            admin = db.scalar(select(SecUser).where(SecUser.id == created.id))
            assert admin is not None
            admin.must_change_password = False
            admin.password_hash = password_hash
        admin_id = admin.id

        company, branch, department = ensure_company_branch_dept(db, tenant, admin_id)
        ensure_attendance_rule(db, tenant, company, branch, admin_id)
        leave_types = ensure_leave_types(db, tenant, company, branch, admin_id)

        # Manager first, then employee reporting to manager
        manager_spec = next(p for p in PEOPLE if p[5])
        emp_spec = next(p for p in PEOPLE if not p[5])

        manager = upsert_person(
            db,
            tenant=tenant,
            company=company,
            branch=branch,
            department=department,
            admin_id=admin_id,
            email=manager_spec[0],
            emp_code=manager_spec[1],
            first=manager_spec[2],
            last=manager_spec[3],
            dob=manager_spec[4],
            is_manager=True,
            manager_employee=None,
            leave_types=leave_types,
            password_hash=password_hash,
        )
        employee = upsert_person(
            db,
            tenant=tenant,
            company=company,
            branch=branch,
            department=department,
            admin_id=admin_id,
            email=emp_spec[0],
            emp_code=emp_spec[1],
            first=emp_spec[2],
            last=emp_spec[3],
            dob=emp_spec[4],
            is_manager=False,
            manager_employee=manager,
            leave_types=leave_types,
            password_hash=password_hash,
        )
        seed_attendance_history(db, tenant, company, branch, employee, admin_id)

        db.commit()
        print("=" * 64)
        print("STORE REVIEW SEED OK")
        print("=" * 64)
        print(f"Company code (type in app): {PORTAL_COMPANY_CODE}")
        print(f"Org company_code (ERP)    : {COMPANY_CODE}")
        print()
        print("EMPLOYEE (primary — use this in App Review notes)")
        print(f"  Email    : {emp_spec[0]}")
        print(f"  Password : {REVIEW_PASSWORD}")
        print(f"  Emp code : {emp_spec[1]}")
        print()
        print("MANAGER (approvals / team)")
        print(f"  Email    : {manager_spec[0]}")
        print(f"  Password : {REVIEW_PASSWORD}")
        print(f"  Emp code : {manager_spec[1]}")
        print()
        print("Also set API env: ESS_STORE_REVIEW_MODE=true")
        print("=" * 64)
    except Exception:
        db.rollback()
        raise
    finally:
        db.close()


if __name__ == "__main__":
    main()
