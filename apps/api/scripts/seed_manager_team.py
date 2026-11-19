"""Seed 2 managers + 4 employees with end-to-end reporting map.

Creates a clean team graph for DEMOCO / HQ:

  MGR-ENG  Vikram Rao     (Engineering Manager)
    ├─ EMP-E01  Rahul Verma
    └─ EMP-E02  Kavya Menon

  MGR-OPS  Ananya Desai   (Operations Manager)
    ├─ EMP-O01  Imran Khan
    └─ EMP-O02  Sneha Joshi

For each person:
  master_employee (reporting_manager_id + user_id)
    → sec_user login (Secure1!)
    → hr_employee_profile
    → hr_employment
    → hr_department_assignment / hr_designation_assignment
    → hr_shift_assignment
    → hr_leave_balance (CL / SL / EL)

Prereqs:
  - alembic upgrade head
  - python -m scripts.seed_demo_data
  - python -m scripts.seed_hr_workforce   (optional; provides leave types / GEN shift)

Usage (from apps/api):
  .venv\\Scripts\\python.exe -m scripts.seed_manager_team
"""

from __future__ import annotations

import sys
from datetime import date, datetime, time, timedelta, timezone
from decimal import Decimal
from pathlib import Path
from uuid import UUID, uuid4

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
from modules.hr.models.department_assignment import HrDepartmentAssignment  # noqa: E402
from modules.hr.models.designation import HrDesignation  # noqa: E402
from modules.hr.models.designation_assignment import HrDesignationAssignment  # noqa: E402
from modules.hr.models.employee_profile import HrEmployeeProfile  # noqa: E402
from modules.hr.models.employment import HrEmployment  # noqa: E402
from modules.hr.models.leave_balance import HrLeaveBalance  # noqa: E402
from modules.hr.models.leave_type import HrLeaveType  # noqa: E402
from modules.hr.models.shift import HrShift  # noqa: E402
from modules.hr.models.shift_assignment import HrShiftAssignment  # noqa: E402
from modules.master_data.models.employee import MasterEmployee  # noqa: E402
from modules.organization.models.branch import OrgBranch  # noqa: E402
from modules.organization.models.company import OrgCompany  # noqa: E402
from modules.organization.models.hierarchy import OrgDepartment  # noqa: E402
from security.password import PasswordHasher  # noqa: E402

DEMO_PASSWORD = "Secure1!"
BALANCE_YEAR = date.today().year

# code, first, last, email, login_email, desig_code, desig_name, job_level, dept_code, doj, ctc, gender, manager_code
TEAM = [
    (
        "MGR-ENG",
        "Vikram",
        "Rao",
        "vikram.rao@example.com",
        "manager.eng@example.com",
        "DES-EM",
        "Engineering Manager",
        "senior",
        "IT",
        date(2022, 3, 1),
        "1800000",
        "male",
        None,
    ),
    (
        "MGR-OPS",
        "Ananya",
        "Desai",
        "ananya.desai@example.com",
        "manager.ops@example.com",
        "DES-OM",
        "Operations Manager",
        "senior",
        "OPS",
        date(2022, 5, 15),
        "1600000",
        "female",
        None,
    ),
    (
        "EMP-E01",
        "Rahul",
        "Verma",
        "rahul.verma@example.com",
        "emp.e01@example.com",
        "DES-SWE",
        "Software Engineer",
        "mid",
        "IT",
        date(2024, 1, 8),
        "1100000",
        "male",
        "MGR-ENG",
    ),
    (
        "EMP-E02",
        "Kavya",
        "Menon",
        "kavya.menon@example.com",
        "emp.e02@example.com",
        "DES-QA",
        "Quality Analyst",
        "junior",
        "IT",
        date(2024, 6, 12),
        "850000",
        "female",
        "MGR-ENG",
    ),
    (
        "EMP-O01",
        "Imran",
        "Khan",
        "imran.khan@example.com",
        "emp.o01@example.com",
        "DES-OPS",
        "Operations Executive",
        "mid",
        "OPS",
        date(2023, 11, 20),
        "900000",
        "male",
        "MGR-OPS",
    ),
    (
        "EMP-O02",
        "Sneha",
        "Joshi",
        "sneha.joshi@example.com",
        "emp.o02@example.com",
        "DES-CSL",
        "Support Specialist",
        "junior",
        "OPS",
        date(2025, 2, 3),
        "720000",
        "female",
        "MGR-OPS",
    ),
]

DEPARTMENTS = [
    ("IT", "Information Technology"),
    ("OPS", "Operations"),
]

LEAVE_TYPE_CODES = ("CL", "SL", "EL")


def utcnow() -> datetime:
    return datetime.now(timezone.utc)


def get_one(db, model, **filters):
    stmt = select(model)
    for k, v in filters.items():
        stmt = stmt.where(getattr(model, k) == v)
    if hasattr(model, "is_deleted"):
        stmt = stmt.where(model.is_deleted.is_(False))
    return db.scalar(stmt)


def ensure(db, model, unique: dict, defaults: dict):
    row = get_one(db, model, **unique)
    if row:
        return row
    valid = {c.key for c in model.__table__.columns}
    payload = {**unique, **{k: v for k, v in defaults.items() if v is not None and k in valid}}
    payload = {k: v for k, v in payload.items() if k in valid}
    row = model(id=uuid4(), **payload)
    db.add(row)
    db.flush()
    return row


def upsert_fields(db, model, unique: dict, fields: dict):
    row = get_one(db, model, **unique)
    if not row:
        return ensure(db, model, unique, fields)
    for key, value in fields.items():
        if hasattr(row, key) and value is not None:
            setattr(row, key, value)
    db.flush()
    return row


def ensure_user(
    db,
    *,
    tenant_id: UUID,
    company_id: UUID,
    branch_id: UUID,
    admin_id: UUID | None,
    email: str,
    display_name: str,
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
            password=DEMO_PASSWORD,
            display_name=display_name,
            user_type="employee",
            created_by=admin_id,
        )
        user = db.scalar(select(SecUser).where(SecUser.id == created.id))
        assert user is not None
    else:
        user.display_name = display_name
        user.user_type = "employee"
        user.password_hash = PasswordHasher.hash_password(DEMO_PASSWORD)
        user.failed_login_count = 0
        user.locked_until = None
        if user.status == "locked":
            user.status = "active"
        user.updated_by = admin_id

    role = db.scalar(
        select(SecRole).where(
            SecRole.tenant_id == tenant_id,
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


def seed(db) -> None:
    PasswordHasher.hash_password(DEMO_PASSWORD)

    tenant = db.scalar(select(SecTenant).where(SecTenant.tenant_code == "BOOTSTRAP"))
    if not tenant:
        raise RuntimeError("BOOTSTRAP tenant missing. Run seed_demo_data first.")

    company = db.scalar(
        select(OrgCompany).where(
            OrgCompany.tenant_id == tenant.id,
            OrgCompany.company_code == "DEMOCO",
            OrgCompany.is_deleted.is_(False),
        )
    )
    branch = (
        db.scalar(
            select(OrgBranch).where(
                OrgBranch.company_id == company.id,
                OrgBranch.branch_code == "HQ",
                OrgBranch.is_deleted.is_(False),
            )
        )
        if company
        else None
    )
    admin = db.scalar(
        select(SecUser).where(
            SecUser.tenant_id == tenant.id,
            SecUser.email == "admin@example.com",
            SecUser.is_deleted.is_(False),
        )
    )
    if not all([company, branch, admin]):
        raise RuntimeError("DEMOCO / HQ / admin missing. Run seed_demo_data first.")

    tenant_id = tenant.id
    company_id = company.id
    branch_id = branch.id
    admin_id = admin.id

    print("Ensuring departments / designations / shift / leave types…")
    departments: dict[str, OrgDepartment] = {}
    for code, name in DEPARTMENTS:
        departments[code] = ensure(
            db,
            OrgDepartment,
            {"tenant_id": tenant_id, "company_id": company_id, "department_code": code},
            {
                "branch_id": branch_id,
                "department_name": name,
                "status": "active",
                "created_by": admin_id,
                "updated_by": admin_id,
            },
        )

    designations: dict[str, HrDesignation] = {}
    for row in TEAM:
        desig_code, desig_name, level = row[5], row[6], row[7]
        designations[desig_code] = ensure(
            db,
            HrDesignation,
            {"tenant_id": tenant_id, "company_id": company_id, "designation_code": desig_code},
            {
                "designation_name": desig_name,
                "job_level": level,
                "status": "active",
                "created_by": admin_id,
                "updated_by": admin_id,
            },
        )

    shift = ensure(
        db,
        HrShift,
        {"tenant_id": tenant_id, "company_id": company_id, "shift_code": "GEN"},
        {
            "branch_id": branch_id,
            "shift_name": "General Shift",
            "shift_type": "general",
            "start_time": time(9, 0),
            "end_time": time(18, 0),
            "grace_minutes": 15,
            "break_minutes": 60,
            "is_overnight": False,
            "status": "active",
            "created_by": admin_id,
            "updated_by": admin_id,
        },
    )

    leave_types: dict[str, HrLeaveType] = {}
    for code, name, max_days, monthly in (
        ("CL", "Casual Leave", Decimal("12"), Decimal("1")),
        ("SL", "Sick Leave", Decimal("10"), Decimal("1")),
        ("EL", "Earned Leave", Decimal("18"), Decimal("1.5")),
    ):
        leave_types[code] = ensure(
            db,
            HrLeaveType,
            {"tenant_id": tenant_id, "company_id": company_id, "leave_type_code": code},
            {
                "leave_type_name": name,
                "is_paid": True,
                "max_days_per_year": max_days,
                "monthly_credit_days": monthly,
                "status": "active",
                "created_by": admin_id,
                "updated_by": admin_id,
            },
        )

    print("Seeding managers + employees (master -> HR -> login)...")
    employees: dict[str, MasterEmployee] = {}
    users: dict[str, SecUser] = {}

    # Pass 1: create people without manager FK
    for idx, (
        code,
        first,
        last,
        email,
        login_email,
        desig_code,
        desig_name,
        _level,
        dept_code,
        doj,
        ctc,
        gender,
        _manager,
    ) in enumerate(TEAM, start=1):
        display = f"{first} {last}"
        user = ensure_user(
            db,
            tenant_id=tenant_id,
            company_id=company_id,
            branch_id=branch_id,
            admin_id=admin_id,
            email=login_email,
            display_name=display,
        )
        users[code] = user

        # Detach login from any other employee row
        for other in db.scalars(
            select(MasterEmployee).where(
                MasterEmployee.tenant_id == tenant_id,
                MasterEmployee.user_id == user.id,
                MasterEmployee.is_deleted.is_(False),
            )
        ).all():
            if other.employee_code != code:
                other.user_id = None

        emp = upsert_fields(
            db,
            MasterEmployee,
            {"tenant_id": tenant_id, "company_id": company_id, "employee_code": code},
            {
                "branch_id": branch_id,
                "department_id": departments[dept_code].id,
                "first_name": first,
                "last_name": last,
                "email": email,
                "mobile": f"+91-98100-{1000 + idx:04d}",
                "designation": desig_name,
                "date_of_joining": doj,
                "status": "active",
                "user_id": user.id,
                "created_by": admin_id,
                "updated_by": admin_id,
            },
        )
        # ensure() path may miss update on existing — force critical fields
        emp.department_id = departments[dept_code].id
        emp.first_name = first
        emp.last_name = last
        emp.email = email
        emp.mobile = f"+91-98100-{1000 + idx:04d}"
        emp.designation = desig_name
        emp.date_of_joining = doj
        emp.status = "active"
        emp.user_id = user.id
        emp.updated_by = admin_id
        employees[code] = emp

        ensure(
            db,
            HrEmployeeProfile,
            {"tenant_id": tenant_id, "employee_id": emp.id},
            {
                "company_id": company_id,
                "branch_id": branch_id,
                "date_of_birth": date(1988 + (idx % 10), (idx % 12) + 1, min(28, idx + 5)),
                "gender": gender,
                "marital_status": "married" if idx % 2 == 0 else "single",
                "nationality": "Indian",
                "blood_group": ["A+", "B+", "O+", "AB+", "A-", "B-"][idx - 1],
                "emergency_contact_name": f"{first} Emergency",
                "emergency_contact_mobile": f"+91-98200-{1000 + idx:04d}",
                "permanent_address_json": {
                    "line1": f"{idx} Team Lane",
                    "city": "Bengaluru",
                    "state_code": "KA",
                    "country_code": "IN",
                    "postal_code": "560001",
                },
                "current_address_json": {
                    "line1": f"{idx} Team Lane",
                    "city": "Bengaluru",
                    "state_code": "KA",
                    "country_code": "IN",
                    "postal_code": "560001",
                },
                "bank_name": "HDFC Bank",
                "bank_account_holder": display,
                "bank_account_number": f"50100{idx:06d}",
                "bank_ifsc": "HDFC0001234",
                "status": "active",
                "created_by": admin_id,
                "updated_by": admin_id,
            },
        )

        ensure(
            db,
            HrEmployment,
            {
                "tenant_id": tenant_id,
                "company_id": company_id,
                "document_number": f"EMPL-{code}",
            },
            {
                "branch_id": branch_id,
                "employee_id": emp.id,
                "employment_type": "permanent",
                "date_of_joining": doj,
                "probation_end_date": doj + timedelta(days=180),
                "confirmation_date": doj + timedelta(days=181),
                "notice_period_days": 60,
                "ctc_amount": Decimal(ctc),
                "currency_code": "INR",
                "work_location_text": "Bengaluru HQ",
                "payroll_eligible": True,
                "lifecycle_source": "direct_add",
                "status": "active",
                "created_by": admin_id,
                "updated_by": admin_id,
            },
        )

        ensure(
            db,
            HrDepartmentAssignment,
            {
                "tenant_id": tenant_id,
                "company_id": company_id,
                "employee_id": emp.id,
                "department_id": departments[dept_code].id,
                "effective_from": doj,
            },
            {
                "branch_id": branch_id,
                "is_primary": True,
                "status": "active",
                "created_by": admin_id,
                "updated_by": admin_id,
            },
        )

        ensure(
            db,
            HrDesignationAssignment,
            {
                "tenant_id": tenant_id,
                "company_id": company_id,
                "employee_id": emp.id,
                "designation_id": designations[desig_code].id,
                "effective_from": doj,
            },
            {
                "branch_id": branch_id,
                "is_primary": True,
                "status": "active",
                "created_by": admin_id,
                "updated_by": admin_id,
            },
        )

        ensure(
            db,
            HrShiftAssignment,
            {
                "tenant_id": tenant_id,
                "company_id": company_id,
                "document_number": f"SFA-{code}",
            },
            {
                "branch_id": branch_id,
                "employee_id": emp.id,
                "shift_id": shift.id,
                "effective_from": doj,
                "status": "active",
                "created_by": admin_id,
                "updated_by": admin_id,
            },
        )

        for lt_code in LEAVE_TYPE_CODES:
            lt = leave_types[lt_code]
            opening = Decimal("12") if lt_code == "CL" else Decimal("10") if lt_code == "SL" else Decimal("18")
            ensure(
                db,
                HrLeaveBalance,
                {
                    "tenant_id": tenant_id,
                    "company_id": company_id,
                    "employee_id": emp.id,
                    "leave_type_id": lt.id,
                    "balance_year": BALANCE_YEAR,
                },
                {
                    "branch_id": branch_id,
                    "opening_balance": opening,
                    "accrued": opening,
                    "used": Decimal("0"),
                    "closing_balance": opening,
                    "status": "open",
                    "created_by": admin_id,
                    "updated_by": admin_id,
                },
            )

    # Pass 2: wire reporting_manager_id end-to-end
    print("Mapping reporting managers…")
    for code, *_rest, manager_code in TEAM:
        emp = employees[code]
        if manager_code:
            mgr = employees[manager_code]
            emp.reporting_manager_id = mgr.id
            emp.updated_by = admin_id
            # Department assignment assigned_by = manager
            dept_code = next(r[8] for r in TEAM if r[0] == code)
            doj = next(r[9] for r in TEAM if r[0] == code)
            asg = get_one(
                db,
                HrDepartmentAssignment,
                tenant_id=tenant_id,
                company_id=company_id,
                employee_id=emp.id,
                department_id=departments[dept_code].id,
                effective_from=doj,
            )
            if asg:
                asg.assigned_by_employee_id = mgr.id
        else:
            emp.reporting_manager_id = None

    db.commit()

    print()
    print("=" * 64)
    print("Manager team seeded (end-to-end)")
    print("=" * 64)
    print(f"{'Code':<10} {'Name':<18} {'Reports to':<10} {'Login':<28}")
    print("-" * 64)
    for code, first, last, _email, login, *_rest, manager_code in TEAM:
        print(f"{code:<10} {first + ' ' + last:<18} {(manager_code or '—'):<10} {login:<28}")
    print("-" * 64)
    print(f"Password for all logins: {DEMO_PASSWORD}")
    print()
    print("Org chart:")
    print("  MGR-ENG Vikram Rao")
    print("    ├─ EMP-E01 Rahul Verma")
    print("    └─ EMP-E02 Kavya Menon")
    print("  MGR-OPS Ananya Desai")
    print("    ├─ EMP-O01 Imran Khan")
    print("    └─ EMP-O02 Sneha Joshi")


def main() -> None:
    db = SessionLocal()
    try:
        seed(db)
    except Exception:
        db.rollback()
        raise
    finally:
        db.close()


if __name__ == "__main__":
    main()
