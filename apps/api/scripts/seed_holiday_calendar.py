"""Upsert published 2026 holiday calendar with rich holiday entries."""

from __future__ import annotations

import sys
from pathlib import Path
from uuid import uuid4

from sqlalchemy import select

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT / "src"))

from database.session import SessionLocal  # noqa: E402
from modules.foundation.models.security import SecTenant, SecUser  # noqa: E402
from modules.hr.models.holiday_calendar import HrHolidayCalendar  # noqa: E402
from modules.organization.models.branch import OrgBranch  # noqa: E402
from modules.organization.models.company import OrgCompany  # noqa: E402

HOLIDAYS = [
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
]


def main() -> None:
    db = SessionLocal()
    try:
        tenant = db.scalar(select(SecTenant).where(SecTenant.tenant_code == "BOOTSTRAP"))
        company = db.scalar(
            select(OrgCompany).where(
                OrgCompany.tenant_id == tenant.id,
                OrgCompany.company_code == "DEMOCO",
                OrgCompany.is_deleted.is_(False),
            )
        )
        admin = db.scalar(
            select(SecUser).where(
                SecUser.tenant_id == tenant.id,
                SecUser.email == "admin@example.com",
                SecUser.is_deleted.is_(False),
            )
        )
        branch = db.scalar(
            select(OrgBranch).where(
                OrgBranch.company_id == company.id,
                OrgBranch.branch_code == "HQ",
                OrgBranch.is_deleted.is_(False),
            )
        )
        if not all([tenant, company, admin]):
            raise SystemExit("DEMOCO / admin missing")

        row = db.scalar(
            select(HrHolidayCalendar).where(
                HrHolidayCalendar.company_id == company.id,
                HrHolidayCalendar.calendar_code == "HOL-2026",
                HrHolidayCalendar.is_deleted.is_(False),
            )
        )
        if row is None:
            row = HrHolidayCalendar(
                id=uuid4(),
                tenant_id=tenant.id,
                company_id=company.id,
                branch_id=branch.id if branch else None,
                calendar_code="HOL-2026",
                calendar_name="India National Holidays 2026",
                calendar_year=2026,
                holidays_json=HOLIDAYS,
                status="published",
                created_by=admin.id,
                updated_by=admin.id,
            )
            db.add(row)
            print("created HOL-2026")
        else:
            row.calendar_name = "India National Holidays 2026"
            row.calendar_year = 2026
            row.holidays_json = HOLIDAYS
            row.status = "published"
            row.updated_by = admin.id
            print("updated HOL-2026")
        db.commit()
        print(f"holidays={len(HOLIDAYS)}")
    except Exception:
        db.rollback()
        raise
    finally:
        db.close()


if __name__ == "__main__":
    main()
