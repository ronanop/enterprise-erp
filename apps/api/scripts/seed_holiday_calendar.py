"""Upsert published 2026 India holiday calendar with rich holiday entries."""

from __future__ import annotations

import sys
from pathlib import Path
from uuid import NAMESPACE_URL, uuid4, uuid5

from sqlalchemy import select

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT / "src"))

from database.session import SessionLocal  # noqa: E402
from modules.foundation.models.security import SecUser  # noqa: E402
from modules.hr.models.holiday_calendar import HrHolidayCalendar  # noqa: E402
from modules.organization.models.branch import OrgBranch  # noqa: E402
from modules.organization.models.company import OrgCompany  # noqa: E402

CALENDAR_CODE = "INDIA_2026"
CALENDAR_NAME = "India Holiday Calendar 2026"
LEGACY_CALENDAR_CODE = "HOL-2026"


def _hol_id(slug: str) -> str:
    return str(uuid5(NAMESPACE_URL, f"holiday:india-2026:{slug}"))


def _entry(
    slug: str,
    title: str,
    date: str,
    holiday_type: str,
    name: str | None = None,
) -> dict:
    display = name or title
    return {
        "id": _hol_id(slug),
        "title": title,
        "name": display,
        "date": date,
        "holiday_type": holiday_type,
        "kind": "mandatory",
        "repeat": "never",
        "frequency": None,
        "half_day": False,
        "half_day_session": None,
        "applicable_to": ["all"],
        "remarks": "",
    }


HOLIDAYS = [
    _entry("republic-day", "Republic Day", "2026-01-26", "national"),
    _entry("holi", "Holi", "2026-03-04", "regional"),
    _entry("id-ul-fitr", "Id-ul-Fitr", "2026-03-21", "regional"),
    _entry("ram-navami", "Ram Navami", "2026-03-26", "regional"),
    _entry("mahavir-jayanti", "Mahavir Jayanti", "2026-03-31", "regional"),
    _entry(
        "annual-closing",
        "Annual Closing of Bank Accounts",
        "2026-04-01",
        "regional",
        name="Annual closing of bank accounts",
    ),
    _entry("good-friday", "Good Friday", "2026-04-03", "regional"),
    _entry("buddha-purnima", "Buddha Purnima", "2026-05-01", "regional"),
    _entry("id-ul-zuha", "Id-ul-Zuha (Bakrid)", "2026-05-27", "regional"),
    _entry("muharram", "Muharram", "2026-06-26", "regional"),
    _entry("independence-day", "Independence Day", "2026-08-15", "national"),
    _entry(
        "milad-un-nabi",
        "Milad-un-Nabi / Id-e-Milad",
        "2026-08-26",
        "regional",
        name="Milad-un-Nabi or Id-e Milad (Birthday of Prophet Mohammad)",
    ),
    _entry(
        "janmashtami",
        "Janmashtami (Vaishnava)",
        "2026-09-04",
        "regional",
        name="Janmashtami (Vaishnva)",
    ),
    _entry("gandhi-jayanti", "Mahatma Gandhi's Birthday", "2026-10-02", "national"),
    _entry("dussehra", "Dussehra", "2026-10-20", "regional"),
    _entry("valmiki-jayanti", "Maharishi Valmiki's Birthday", "2026-10-26", "regional"),
    _entry("diwali", "Diwali (Deepavali)", "2026-11-08", "regional"),
    _entry("guru-nanak", "Guru Nanak's Birthday", "2026-11-24", "regional"),
    _entry("christmas", "Christmas Day", "2026-12-25", "regional"),
]


_ACTOR_EMAILS = ("admin@example.com", "admin@cachedigitech.com")


def _actor_for_tenant(db, tenant_id):
    for email in _ACTOR_EMAILS:
        user = db.scalar(
            select(SecUser).where(
                SecUser.tenant_id == tenant_id,
                SecUser.email == email,
                SecUser.is_deleted.is_(False),
            )
        )
        if user is not None:
            return user
    return db.scalar(
        select(SecUser).where(
            SecUser.tenant_id == tenant_id,
            SecUser.is_deleted.is_(False),
        )
    )


def _upsert_calendar(db, company, actor) -> str:
    branch = db.scalar(
        select(OrgBranch).where(
            OrgBranch.company_id == company.id,
            OrgBranch.branch_code == "HQ",
            OrgBranch.is_deleted.is_(False),
        )
    )
    row = db.scalar(
        select(HrHolidayCalendar).where(
            HrHolidayCalendar.company_id == company.id,
            HrHolidayCalendar.calendar_code == CALENDAR_CODE,
            HrHolidayCalendar.is_deleted.is_(False),
        )
    )
    if row is None:
        row = db.scalar(
            select(HrHolidayCalendar).where(
                HrHolidayCalendar.company_id == company.id,
                HrHolidayCalendar.calendar_code == LEGACY_CALENDAR_CODE,
                HrHolidayCalendar.is_deleted.is_(False),
            )
        )
    if row is None:
        db.add(
            HrHolidayCalendar(
                id=uuid4(),
                tenant_id=company.tenant_id,
                company_id=company.id,
                branch_id=branch.id if branch else None,
                calendar_code=CALENDAR_CODE,
                calendar_name=CALENDAR_NAME,
                calendar_year=2026,
                holidays_json=HOLIDAYS,
                status="published",
                created_by=actor.id if actor else None,
                updated_by=actor.id if actor else None,
            )
        )
        return "created"
    row.calendar_code = CALENDAR_CODE
    row.calendar_name = CALENDAR_NAME
    row.calendar_year = 2026
    row.holidays_json = HOLIDAYS
    row.status = "published"
    if actor is not None:
        row.updated_by = actor.id
    return "updated"


def main() -> None:
    db = SessionLocal()
    try:
        companies = list(
            db.scalars(
                select(OrgCompany).where(
                    OrgCompany.company_code == "DEMOCO",
                    OrgCompany.is_deleted.is_(False),
                )
            ).all()
        )
        if not companies:
            raise SystemExit("No active DEMOCO company found")

        for company in companies:
            actor = _actor_for_tenant(db, company.tenant_id)
            action = _upsert_calendar(db, company, actor)
            print(f"{action} {CALENDAR_CODE} company={company.id}")
        db.commit()
        print(f"holidays={len(HOLIDAYS)}")
    except Exception:
        db.rollback()
        raise
    finally:
        db.close()


if __name__ == "__main__":
    main()
