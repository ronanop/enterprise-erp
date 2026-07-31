"""Seed connected HR workforce demo data: employees, leave, attendance.

Creates a coherent people graph for DEMOCO / HQ:
  master_employee
    → hr_employee_profile
    → hr_employment
    → hr_department_assignment / hr_designation_assignment
    → hr_shift_assignment
    → hr_leave_balance (CL / SL / EL)
    → hr_leave_request (draft / submitted / approved)
    → hr_attendance (working days; leave days marked absent)

Prereqs:
  - alembic upgrade head
  - python -m scripts.seed_demo_data

Usage (from apps/api):
  .venv\\Scripts\\python.exe -m scripts.seed_hr_workforce
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
from modules.foundation.models.security import SecTenant, SecUser  # noqa: E402
from modules.hr.models.attendance import HrAttendance  # noqa: E402
from modules.hr.models.department_assignment import HrDepartmentAssignment  # noqa: E402
from modules.hr.models.designation import HrDesignation  # noqa: E402
from modules.hr.models.designation_assignment import HrDesignationAssignment  # noqa: E402
from modules.hr.models.employee_profile import HrEmployeeProfile  # noqa: E402
from modules.hr.models.employment import HrEmployment  # noqa: E402
from modules.hr.models.holiday_calendar import HrHolidayCalendar  # noqa: E402
from modules.hr.models.leave_balance import HrLeaveBalance  # noqa: E402
from modules.hr.models.leave_request import HrLeaveRequest  # noqa: E402
from modules.hr.models.leave_type import HrLeaveType  # noqa: E402
from modules.hr.models.performance_review import HrPerformanceReview  # noqa: E402
from modules.hr.models.shift import HrShift  # noqa: E402
from modules.hr.models.shift_assignment import HrShiftAssignment  # noqa: E402
from modules.hr.models.training import HrTraining  # noqa: E402
from modules.hr.models.training_attendance import HrTrainingAttendance  # noqa: E402
from modules.master_data.models.employee import MasterEmployee  # noqa: E402
from modules.organization.models.branch import OrgBranch  # noqa: E402
from modules.organization.models.company import OrgCompany  # noqa: E402
from modules.organization.models.hierarchy import OrgDepartment  # noqa: E402
from modules.recruitment.models.application import RecApplication  # noqa: E402
from modules.recruitment.models.candidate import RecCandidate  # noqa: E402
from modules.recruitment.models.job_posting import RecJobPosting  # noqa: E402
from modules.recruitment.models.job_requisition import RecJobRequisition  # noqa: E402
from modules.recruitment.models.recruiter import RecRecruiter  # noqa: E402
from modules.recruitment.models.recruitment_source import RecRecruitmentSource  # noqa: E402

BALANCE_YEAR = 2026

EMPLOYEES = [
    # code, first, last, email, designation_code, designation_name, job_level, dept_code,
    # doj, ctc, gender, manager_code
    ("EMP-001", "Asha", "Nair", "asha.nair@example.com", "DES-HRM", "HR Manager", "senior", "HR", date(2023, 1, 15), "1200000", "female", None),
    ("EMP-002", "Rohan", "Mehta", "rohan.mehta@example.com", "DES-ACC", "Accountant", "mid", "FIN", date(2023, 6, 1), "900000", "male", "EMP-001"),
    ("EMP-003", "Neha", "Kapoor", "neha.kapoor@example.com", "DES-SAL", "Sales Executive", "junior", "SAL", date(2024, 2, 12), "750000", "female", "EMP-001"),
    ("EMP-004", "Priya", "Sharma", "priya.sharma@example.com", "DES-SWE", "Software Engineer", "mid", "IT", date(2024, 4, 1), "1100000", "female", "EMP-007"),
    ("EMP-005", "Arjun", "Patel", "arjun.patel@example.com", "DES-WHS", "Warehouse Supervisor", "mid", "OPS", date(2023, 9, 18), "850000", "male", "EMP-001"),
    ("EMP-006", "Meera", "Iyer", "meera.iyer@example.com", "DES-QA", "Quality Analyst", "junior", "QA", date(2024, 7, 8), "780000", "female", "EMP-007"),
    ("EMP-007", "Kabir", "Singh", "kabir.singh@example.com", "DES-PM", "Project Manager", "senior", "IT", date(2022, 11, 3), "1500000", "male", "EMP-001"),
    ("EMP-008", "Sana", "Qureshi", "sana.qureshi@example.com", "DES-CSL", "Customer Support Lead", "mid", "CS", date(2024, 1, 22), "820000", "female", "EMP-001"),
]

DEPARTMENTS = [
    ("HR", "Human Resources"),
    ("FIN", "Finance"),
    ("SAL", "Sales"),
    ("IT", "Information Technology"),
    ("OPS", "Operations"),
    ("QA", "Quality Assurance"),
    ("CS", "Customer Support"),
]

LEAVE_TYPES = [
    # code, name, max_days_per_year, monthly_credit_days, is_paid
    ("CL", "Casual Leave", Decimal("12"), Decimal("1"), True),
    ("SL", "Sick Leave", Decimal("10"), Decimal("1"), True),
    ("EL", "Earned Leave", Decimal("18"), Decimal("1.5"), True),
    ("ML", "Maternity Leave", Decimal("182"), None, True),
    ("PL", "Paternity Leave", Decimal("15"), None, True),
    ("LOP", "Loss of Pay", Decimal("0"), None, False),
    ("CO", "Comp Off", Decimal("0"), None, True),
]

def previous_weekdays(from_day: date, count: int) -> list[date]:
    days: list[date] = []
    cursor = from_day - timedelta(days=1)
    while len(days) < count:
        if cursor.weekday() < 5:
            days.append(cursor)
        cursor -= timedelta(days=1)
    days.reverse()
    return days


def next_weekdays(from_day: date, count: int) -> list[date]:
    days: list[date] = []
    cursor = from_day + timedelta(days=1)
    while len(days) < count:
        if cursor.weekday() < 5:
            days.append(cursor)
        cursor += timedelta(days=1)
    return days


# Leave scenarios expressed in weekday slots so weekends never break attendance links.
# past_n / future_n are 1-based indexes into previous/next weekdays.
LEAVE_SCENARIOS = [
    # emp, type, start_slot, end_slot, when, status, doc, reason
    ("EMP-001", "CL", 4, 3, "past", "approved", "0001", "Family function"),
    ("EMP-002", "SL", 1, 1, "past", "approved", "0002", "Fever / medical rest"),
    ("EMP-003", "CL", 2, 3, "future", "submitted", "0003", "Personal travel"),
    ("EMP-004", "EL", 5, 7, "future", "draft", "0004", "Planned vacation"),
    ("EMP-005", "CL", 2, 2, "past", "approved", "0005", "Personal work"),
    ("EMP-006", "SL", 1, 1, "future", "submitted", "0006", "Medical appointment"),
    ("EMP-007", "CL", 6, 5, "past", "approved", "0007", "Out of station"),
    ("EMP-008", "EL", 4, 5, "future", "draft", "0008", "Long weekend trip"),
]

EMERGENCY = {
    "EMP-001": ("Deepa Nair", "+91-90000-20001"),
    "EMP-002": ("Sunil Mehta", "+91-90000-20002"),
    "EMP-003": ("Anjali Kapoor", "+91-90000-20003"),
    "EMP-004": ("Rajesh Sharma", "+91-90000-20004"),
    "EMP-005": ("Kavita Patel", "+91-90000-20005"),
    "EMP-006": ("Suresh Iyer", "+91-90000-20006"),
    "EMP-007": ("Simran Singh", "+91-90000-20007"),
    "EMP-008": ("Imran Qureshi", "+91-90000-20008"),
}


def utcnow() -> datetime:
    return datetime.now(timezone.utc)


IST = timezone(timedelta(hours=5, minutes=30))


def punch_at(day: date, hour: int, minute: int) -> datetime:
    """Wall-clock India time stored with IST offset so UI local formatting is correct."""
    return datetime(day.year, day.month, day.day, hour, minute, tzinfo=IST)


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


def upsert_fields(db, model, unique: dict, fields: dict, *, allow_none: bool = False):
    row = get_one(db, model, **unique)
    if not row:
        return ensure(db, model, unique, fields)
    for key, value in fields.items():
        if not hasattr(row, key):
            continue
        if value is None and not allow_none:
            continue
        setattr(row, key, value)
    db.flush()
    return row


def working_days(end: date, count: int) -> list[date]:
    days: list[date] = []
    cursor = end
    while len(days) < count:
        if cursor.weekday() < 5:
            days.append(cursor)
        cursor -= timedelta(days=1)
    days.reverse()
    return days


def daterange(start: date, end: date) -> list[date]:
    out: list[date] = []
    cur = start
    while cur <= end:
        out.append(cur)
        cur += timedelta(days=1)
    return out


def seed(db) -> None:
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

    tenant_id: UUID = tenant.id
    company_id: UUID = company.id
    branch_id: UUID = branch.id
    admin_id: UUID = admin.id
    today = date.today()

    print("Seeding departments…")
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

    print("Seeding designations / leave types / shift…")
    designations: dict[str, HrDesignation] = {}
    for _, _, _, _, desig_code, desig_name, level, *_rest in EMPLOYEES:
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

    leave_types: dict[str, HrLeaveType] = {}
    for code, name, max_days, monthly_days, is_paid in LEAVE_TYPES:
        leave_types[code] = ensure(
            db,
            HrLeaveType,
            {"tenant_id": tenant_id, "company_id": company_id, "leave_type_code": code},
            {
                "leave_type_name": name,
                "is_paid": is_paid,
                "max_days_per_year": max_days,
                "monthly_credit_days": monthly_days,
                "requires_attachment": code == "SL",
                "status": "active",
                "created_by": admin_id,
                "updated_by": admin_id,
            },
        )
        upsert_fields(
            db,
            HrLeaveType,
            {"tenant_id": tenant_id, "company_id": company_id, "leave_type_code": code},
            {
                "leave_type_name": name,
                "is_paid": is_paid,
                "max_days_per_year": max_days,
                "monthly_credit_days": monthly_days,
                "requires_attachment": code == "SL",
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

    ensure(
        db,
        HrHolidayCalendar,
        {"tenant_id": tenant_id, "company_id": company_id, "calendar_code": "HOL-2026"},
        {
            "branch_id": branch_id,
            "calendar_name": "India National Holidays 2026",
            "calendar_year": 2026,
            "holidays_json": [
                {
                    "id": "hol-republic",
                    "title": "Republic Day",
                    "name": "Republic Day",
                    "date": "2026-01-26",
                    "holiday_type": "national",
                    "kind": "mandatory",
                    "repeat": "every_year",
                    "frequency": "yearly",
                    "half_day": False,
                    "half_day_session": None,
                    "applicable_to": ["all"],
                    "remarks": "National holiday",
                },
                {
                    "id": "hol-independence",
                    "title": "Independence Day",
                    "name": "Independence Day",
                    "date": "2026-08-15",
                    "holiday_type": "national",
                    "kind": "mandatory",
                    "repeat": "every_year",
                    "frequency": "yearly",
                    "half_day": False,
                    "half_day_session": None,
                    "applicable_to": ["all"],
                    "remarks": "",
                },
                {
                    "id": "hol-gandhi",
                    "title": "Gandhi Jayanti",
                    "name": "Gandhi Jayanti",
                    "date": "2026-10-02",
                    "holiday_type": "national",
                    "kind": "mandatory",
                    "repeat": "every_year",
                    "frequency": "yearly",
                    "half_day": False,
                    "half_day_session": None,
                    "applicable_to": ["all"],
                    "remarks": "",
                },
                {
                    "id": "hol-christmas",
                    "title": "Christmas Day",
                    "name": "Christmas Day",
                    "date": "2026-12-25",
                    "holiday_type": "optional",
                    "kind": "optional",
                    "repeat": "every_year",
                    "frequency": "yearly",
                    "half_day": False,
                    "half_day_session": None,
                    "applicable_to": ["all"],
                    "remarks": "Optional company holiday",
                },
            ],
            "status": "published",
            "created_by": admin_id,
            "updated_by": admin_id,
        },
    )

    print("Seeding master employees + HR profiles / employment…")
    employees: dict[str, MasterEmployee] = {}
    for idx, (
        code,
        first,
        last,
        email,
        desig_code,
        desig_name,
        _level,
        dept_code,
        doj,
        ctc,
        gender,
        _manager,
    ) in enumerate(EMPLOYEES, start=1):
        emp = ensure(
            db,
            MasterEmployee,
            {"tenant_id": tenant_id, "company_id": company_id, "employee_code": code},
            {
                "branch_id": branch_id,
                "department_id": departments[dept_code].id,
                "first_name": first,
                "last_name": last,
                "email": email,
                "mobile": f"+91-90000-{idx:04d}",
                "designation": desig_name,
                "date_of_joining": doj,
                "status": "active",
                "created_by": admin_id,
                "updated_by": admin_id,
            },
        )
        upsert_fields(
            db,
            MasterEmployee,
            {"tenant_id": tenant_id, "company_id": company_id, "employee_code": code},
            {
                "department_id": departments[dept_code].id,
                "first_name": first,
                "last_name": last,
                "email": email,
                "designation": desig_name,
                "date_of_joining": doj,
                "status": "active",
            },
        )
        employees[code] = emp

        contact_name, contact_mobile = EMERGENCY[code]
        ensure(
            db,
            HrEmployeeProfile,
            {"tenant_id": tenant_id, "employee_id": emp.id},
            {
                "company_id": company_id,
                "branch_id": branch_id,
                "date_of_birth": date(1990 + (idx % 8), (idx % 12) + 1, min(28, idx + 3)),
                "gender": gender,
                "marital_status": "married" if idx % 2 == 0 else "single",
                "nationality": "Indian",
                "blood_group": ["A+", "B+", "O+", "AB+", "A-", "B-", "O-", "AB-"][idx - 1],
                "emergency_contact_name": contact_name,
                "emergency_contact_mobile": contact_mobile,
                "permanent_address_json": {
                    "line1": f"{idx * 10} Residency Road",
                    "city": "Bengaluru",
                    "state_code": "KA",
                    "country_code": "IN",
                    "postal_code": "560001",
                },
                "current_address_json": {
                    "line1": f"{idx * 10} Residency Road",
                    "city": "Bengaluru",
                    "state_code": "KA",
                    "country_code": "IN",
                    "postal_code": "560001",
                },
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
                "assigned_by_employee_id": None,
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

    # Wire assigned_by after manager employees exist.
    for code, *_rest, manager_code in EMPLOYEES:
        if not manager_code:
            continue
        emp = employees[code]
        dept_code = next(row[7] for row in EMPLOYEES if row[0] == code)
        asg = get_one(
            db,
            HrDepartmentAssignment,
            tenant_id=tenant_id,
            company_id=company_id,
            employee_id=emp.id,
            department_id=departments[dept_code].id,
            effective_from=next(row[8] for row in EMPLOYEES if row[0] == code),
        )
        if asg and employees.get(manager_code):
            asg.assigned_by_employee_id = employees[manager_code].id

    print("Seeding leave balances + leave requests…")
    used_by_employee: dict[str, dict[str, Decimal]] = {
        code: {lt: Decimal("0") for lt in leave_types} for code in employees
    }
    leave_days_by_employee: dict[str, set[date]] = {code: set() for code in employees}

    past = previous_weekdays(today, 10)
    future = next_weekdays(today, 10)

    for emp_code, lt_code, start_slot, end_slot, when, status, doc_suffix, reason in LEAVE_SCENARIOS:
        emp = employees[emp_code]
        leave_type = leave_types[lt_code]
        pool = past if when == "past" else future
        # slots are 1-based from "most recent/next"
        start = pool[-start_slot] if when == "past" else pool[start_slot - 1]
        end = pool[-end_slot] if when == "past" else pool[end_slot - 1]
        if end < start:
            start, end = end, start
        leave_weekdays = [d for d in daterange(start, end) if d.weekday() < 5]
        days = Decimal(str(len(leave_weekdays) or 1))
        # Keep request dates on weekdays only so days_count matches attendance.
        start, end = leave_weekdays[0], leave_weekdays[-1]
        doc = f"LR-{doc_suffix}"

        ensure(
            db,
            HrLeaveRequest,
            {"tenant_id": tenant_id, "company_id": company_id, "document_number": doc},
            {
                "branch_id": branch_id,
                "employee_id": emp.id,
                "leave_type_id": leave_type.id,
                "start_date": start,
                "end_date": end,
                "days_count": days,
                "reason": reason,
                "status": status,
                "approver_employee_id": employees["EMP-001"].id if status == "approved" else None,
                "decided_at": utcnow() if status == "approved" else None,
                "created_by": admin_id,
                "updated_by": admin_id,
            },
        )
        upsert_fields(
            db,
            HrLeaveRequest,
            {"tenant_id": tenant_id, "company_id": company_id, "document_number": doc},
            {
                "employee_id": emp.id,
                "leave_type_id": leave_type.id,
                "start_date": start,
                "end_date": end,
                "days_count": days,
                "reason": reason,
                "status": status,
                "approver_employee_id": employees["EMP-001"].id if status == "approved" else None,
                "decided_at": utcnow() if status == "approved" else None,
            },
        )

        if status == "approved":
            used_by_employee[emp_code][lt_code] += days
            leave_days_by_employee[emp_code].update(leave_weekdays)

    for emp_code, emp in employees.items():
        for lt_code, leave_type in leave_types.items():
            opening = leave_type.max_days_per_year or Decimal("12")
            used = used_by_employee[emp_code][lt_code]
            closing = opening - used
            ensure(
                db,
                HrLeaveBalance,
                {
                    "tenant_id": tenant_id,
                    "company_id": company_id,
                    "employee_id": emp.id,
                    "leave_type_id": leave_type.id,
                    "balance_year": BALANCE_YEAR,
                },
                {
                    "branch_id": branch_id,
                    "opening_balance": opening,
                    "accrued": Decimal("0"),
                    "used": used,
                    "closing_balance": closing,
                    "status": "open",
                    "created_by": admin_id,
                    "updated_by": admin_id,
                },
            )
            upsert_fields(
                db,
                HrLeaveBalance,
                {
                    "tenant_id": tenant_id,
                    "company_id": company_id,
                    "employee_id": emp.id,
                    "leave_type_id": leave_type.id,
                    "balance_year": BALANCE_YEAR,
                },
                {
                    "opening_balance": opening,
                    "accrued": Decimal("0"),
                    "used": used,
                    "closing_balance": closing,
                    "status": "open",
                },
            )

    print("Seeding attendance (last 60 working days, linked to shift + leave)…")
    attendance_days = working_days(today, 60)
    # Stagger punch times so the register shows distinct check-in / check-out per employee.
    punch_offsets = {
        "EMP-001": (5, 10),
        "EMP-002": (12, 5),
        "EMP-003": (8, 20),
        "EMP-004": (3, 15),
        "EMP-005": (18, 0),
        "EMP-006": (7, 25),
        "EMP-007": (2, 30),
        "EMP-008": (10, 12),
    }
    locations = {
        "EMP-001": "HQ · Floor 2",
        "EMP-002": "HQ · Finance Wing",
        "EMP-003": "HQ · Sales Floor",
        "EMP-004": "HQ · IT Lab",
        "EMP-005": "Warehouse Gate",
        "EMP-006": "HQ · QA Bay",
        "EMP-007": "HQ · Floor 4",
        "EMP-008": "HQ · Support Desk",
    }
    attendance_count = 0
    for emp_code, emp in employees.items():
        leave_days = leave_days_by_employee[emp_code]
        in_off, out_off = punch_offsets.get(emp_code, (5, 10))
        loc = locations.get(emp_code, "HQ Office")
        for day_i, day in enumerate(attendance_days):
            source = "biometric"
            if day in leave_days:
                status_day = "absent"
                check_in = None
                check_out = None
                total_hours = None
                notes = f"On approved leave · {loc}"
                row_status = "recorded"
                source = "manual"
            elif day.weekday() == 4 and emp_code in {"EMP-003", "EMP-006"}:
                status_day = "work_from_home"
                check_in = punch_at(day, 9, 15 + (in_off % 10))
                check_out = punch_at(day, 17, 45)
                total_hours = Decimal("8.00")
                notes = f"WFH Friday · Location:{loc}"
                row_status = "recorded"
                source = "mobile"
            elif day_i % 17 == 0 and emp_code in {"EMP-005", "EMP-008"}:
                status_day = "half_day"
                check_in = punch_at(day, 9, 10)
                check_out = punch_at(day, 13, 0)
                total_hours = Decimal("4.00")
                notes = f"Half day · Location:{loc}"
                row_status = "recorded"
            elif day.weekday() == 0 and emp_code in {"EMP-002", "EMP-005"}:
                # Late Monday arrival
                status_day = "present"
                check_in = punch_at(day, 10, 5 + in_off % 20)
                check_out = punch_at(day, 18, 20 + out_off % 20)
                total_hours = Decimal("7.75")
                notes = f"Late arrival · Location:{loc}"
                row_status = "recorded"
            else:
                status_day = "present"
                check_in = punch_at(day, 9, in_off % 25)
                check_out = punch_at(day, 18, 5 + (out_off % 35))
                # ~8.5–9.25h so OT shows for some employees
                hours = Decimal("8.50") + (Decimal(out_off % 5) / Decimal("10"))
                total_hours = hours
                notes = f"Location:{loc}"
                row_status = "locked" if day < today - timedelta(days=2) else "recorded"

            ensure(
                db,
                HrAttendance,
                {
                    "tenant_id": tenant_id,
                    "company_id": company_id,
                    "employee_id": emp.id,
                    "attendance_date": day,
                },
                {
                    "branch_id": branch_id,
                    "check_in_at": check_in,
                    "check_out_at": check_out,
                    "total_hours": total_hours,
                    "attendance_status": status_day,
                    "source": source,
                    "shift_id": shift.id,
                    "status": row_status,
                    "notes": notes,
                    "created_by": admin_id,
                    "updated_by": admin_id,
                },
            )
            upsert_fields(
                db,
                HrAttendance,
                {
                    "tenant_id": tenant_id,
                    "company_id": company_id,
                    "employee_id": emp.id,
                    "attendance_date": day,
                },
                {
                    "check_in_at": check_in,
                    "check_out_at": check_out,
                    "total_hours": total_hours,
                    "attendance_status": status_day,
                    "source": source,
                    "shift_id": shift.id,
                    "status": row_status,
                    "notes": notes,
                },
                allow_none=True,
            )
            attendance_count += 1

    print("Seeding performance reviews + training…")
    ratings = [5, 4, 4, 3, 4, 5, 4, 3]
    for idx, (emp_code, emp) in enumerate(employees.items()):
        reviewer = employees["EMP-001"] if emp_code != "EMP-001" else employees["EMP-007"]
        ensure(
            db,
            HrPerformanceReview,
            {
                "tenant_id": tenant_id,
                "company_id": company_id,
                "document_number": f"PRF-{emp_code}",
            },
            {
                "branch_id": branch_id,
                "employee_id": emp.id,
                "reviewer_employee_id": reviewer.id,
                "review_cycle": "yearly",
                "period_start": date(BALANCE_YEAR, 4, 1),
                "period_end": date(BALANCE_YEAR + 1, 3, 31),
                "status": "approved" if idx < 6 else "submitted",
                "overall_rating": ratings[idx % len(ratings)],
                "created_by": admin_id,
                "updated_by": admin_id,
            },
        )
        upsert_fields(
            db,
            HrPerformanceReview,
            {
                "tenant_id": tenant_id,
                "company_id": company_id,
                "document_number": f"PRF-{emp_code}",
            },
            {
                "overall_rating": ratings[idx % len(ratings)],
                "status": "approved" if idx < 6 else "submitted",
                "reviewer_employee_id": reviewer.id,
            },
        )

    trainings = [
        ("TRN-COMP", "POSH & Code of Conduct", "compliance", "completed"),
        ("TRN-TECH", "Python FastAPI Deep Dive", "technical", "in_progress"),
        ("TRN-LEAD", "People Leadership Essentials", "leadership", "planned"),
    ]
    training_rows: dict[str, HrTraining] = {}
    for code, name, ttype, status in trainings:
        training_rows[code] = ensure(
            db,
            HrTraining,
            {"tenant_id": tenant_id, "company_id": company_id, "training_code": code},
            {
                "branch_id": branch_id,
                "training_name": name,
                "training_type": ttype,
                "trainer_name": "Internal L&D",
                "trainer_employee_id": employees["EMP-001"].id,
                "start_date": today - timedelta(days=30),
                "end_date": today + timedelta(days=30),
                "status": status,
                "created_by": admin_id,
                "updated_by": admin_id,
            },
        )

    train_att_status = {
        "TRN-COMP": "completed",
        "TRN-TECH": "attended",
        "TRN-LEAD": "registered",
    }
    for emp_code, emp in employees.items():
        for tcode, training in training_rows.items():
            # Leadership training only for managers/seniors.
            if tcode == "TRN-LEAD" and emp_code not in {"EMP-001", "EMP-007", "EMP-005", "EMP-008"}:
                continue
            att_status = train_att_status[tcode]
            pct = {
                "completed": Decimal("100"),
                "attended": Decimal("60"),
                "registered": Decimal("0"),
            }[att_status]
            ensure(
                db,
                HrTrainingAttendance,
                {
                    "tenant_id": tenant_id,
                    "company_id": company_id,
                    "training_id": training.id,
                    "employee_id": emp.id,
                },
                {
                    "branch_id": branch_id,
                    "attendance_status": att_status,
                    "completion_percent": pct,
                    "status": "active",
                    "created_by": admin_id,
                    "updated_by": admin_id,
                },
            )

    print("Seeding recruitment funnel (jobs + candidates + applications)…")
    it_dept = departments["IT"]
    source = ensure(
        db,
        RecRecruitmentSource,
        {"tenant_id": tenant_id, "company_id": company_id, "source_code": "SRC-CAREER"},
        {
            "branch_id": branch_id,
            "source_name": "Career Site",
            "source_type": "organic",
            "status": "active",
            "created_by": admin_id,
            "updated_by": admin_id,
        },
    )
    recruiter = ensure(
        db,
        RecRecruiter,
        {"tenant_id": tenant_id, "company_id": company_id, "employee_id": employees["EMP-001"].id},
        {
            "branch_id": branch_id,
            "recruiter_code": "RCR-0001",
            "display_name": "Asha Nair",
            "max_open_requisitions": 10,
            "status": "active",
            "created_by": admin_id,
            "updated_by": admin_id,
        },
    )
    req = ensure(
        db,
        RecJobRequisition,
        {"tenant_id": tenant_id, "company_id": company_id, "document_number": "JR-DASH-001"},
        {
            "branch_id": branch_id,
            "requisition_title": "Software Engineer",
            "department_id": it_dept.id,
            "employment_type": "permanent",
            "openings_count": 2,
            "hiring_manager_employee_id": employees["EMP-007"].id,
            "status": "approved",
            "created_by": admin_id,
            "updated_by": admin_id,
        },
    )
    posting = ensure(
        db,
        RecJobPosting,
        {"tenant_id": tenant_id, "company_id": company_id, "document_number": "JP-DASH-001"},
        {
            "job_requisition_id": req.id,
            "posting_title": "Software Engineer - Bengaluru",
            "channel": "career_site",
            "status": "published",
            "created_by": admin_id,
            "updated_by": admin_id,
        },
    )
    req2 = ensure(
        db,
        RecJobRequisition,
        {"tenant_id": tenant_id, "company_id": company_id, "document_number": "JR-DASH-002"},
        {
            "branch_id": branch_id,
            "requisition_title": "Finance Analyst",
            "department_id": departments["FIN"].id,
            "employment_type": "permanent",
            "openings_count": 1,
            "hiring_manager_employee_id": employees["EMP-001"].id,
            "status": "approved",
            "created_by": admin_id,
            "updated_by": admin_id,
        },
    )
    ensure(
        db,
        RecJobPosting,
        {"tenant_id": tenant_id, "company_id": company_id, "document_number": "JP-DASH-002"},
        {
            "job_requisition_id": req2.id,
            "posting_title": "Finance Analyst",
            "channel": "career_site",
            "status": "published",
            "created_by": admin_id,
            "updated_by": admin_id,
        },
    )

    funnel_candidates = [
        ("CAND-D01", "Ankit", "Verma", "applied"),
        ("CAND-D02", "Sneha", "Reddy", "applied"),
        ("CAND-D03", "Tarun", "Gupta", "screening"),
        ("CAND-D04", "Ishita", "Bose", "screening"),
        ("CAND-D05", "Vikram", "Das", "interview"),
        ("CAND-D06", "Pooja", "Nair", "interview"),
        ("CAND-D07", "Rahul", "Sen", "offer"),
        ("CAND-D08", "Kavya", "Menon", "hired"),
    ]
    for i, (code, first, last, app_status) in enumerate(funnel_candidates, start=1):
        cand = ensure(
            db,
            RecCandidate,
            {"tenant_id": tenant_id, "company_id": company_id, "candidate_code": code},
            {
                "first_name": first,
                "last_name": last,
                "full_name": f"{first} {last}",
                "email": f"{first.lower()}.{last.lower()}@example.com",
                "status": "applied",
                "created_by": admin_id,
                "updated_by": admin_id,
            },
        )
        ensure(
            db,
            RecApplication,
            {
                "tenant_id": tenant_id,
                "company_id": company_id,
                "document_number": f"APP-DASH-{i:03d}",
            },
            {
                "branch_id": branch_id,
                "candidate_id": cand.id,
                "job_requisition_id": req.id if i <= 6 else req2.id,
                "job_posting_id": posting.id,
                "recruitment_source_id": source.id,
                "recruiter_id": recruiter.id,
                "applied_at": utcnow() - timedelta(days=20 - i),
                "current_stage_code": app_status,
                "status": app_status,
                "created_by": admin_id,
                "updated_by": admin_id,
            },
        )
        upsert_fields(
            db,
            RecApplication,
            {
                "tenant_id": tenant_id,
                "company_id": company_id,
                "document_number": f"APP-DASH-{i:03d}",
            },
            {
                "status": app_status,
                "current_stage_code": app_status,
                "candidate_id": cand.id,
                "job_requisition_id": req.id if i <= 6 else req2.id,
            },
        )

    db.commit()

    print("=" * 64)
    print("HR workforce seed complete (connected graph)")
    print("=" * 64)
    print(f"Employees           : {len(employees)}")
    print(f"Departments         : {len(departments)}")
    print(f"Designations        : {len(designations)}")
    print(f"Leave types         : {len(leave_types)}")
    print(f"Leave requests      : {len(LEAVE_SCENARIOS)}")
    print(f"Leave balances      : {len(employees) * len(leave_types)}")
    print(f"Attendance rows     : {attendance_count}")
    print(f"Performance reviews : {len(employees)}")
    print(f"Trainings           : {len(training_rows)}")
    print(f"Recruitment apps    : {len(funnel_candidates)}")
    print(f"Shift               : {shift.shift_code} ({shift.shift_name})")
    print("-" * 64)
    print("Sample connections:")
    print("  EMP-001 Asha Nair  -> approved CL leave -> attendance absent those days")
    print("  EMP-002 Rohan Mehta -> approved SL -> balance used +1")
    print("  EMP-003 Neha Kapoor -> submitted upcoming CL (pending approval)")
    print("  All employees      -> profile + employment + dept/desig/shift + balances")
    print("  Analytics          -> reviews, training attendance, recruitment funnel")
    print("=" * 64)


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
