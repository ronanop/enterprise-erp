"""Seed sample meeting room bookings for ESS demo.

Prereqs:
  python -m scripts.seed_demo_data
  python -m scripts.seed_hr_workforce
  python -m scripts.seed_training_rooms

Usage (from apps/api):
  python -m scripts.seed_meeting_bookings
"""

from __future__ import annotations

import sys
from datetime import date, datetime, time, timedelta, timezone
from pathlib import Path
from uuid import uuid4

from sqlalchemy import select

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT / "src"))

from database.session import SessionLocal  # noqa: E402
from modules.foundation.models.security import SecTenant, SecUser  # noqa: E402
from modules.hr.models.training_request import HrTrainingRequest  # noqa: E402
from modules.hr.models.training_room import HrTrainingRoom  # noqa: E402
from modules.master_data.models.employee import MasterEmployee  # noqa: E402
from modules.organization.models.branch import OrgBranch  # noqa: E402
from modules.organization.models.company import OrgCompany  # noqa: E402

# (room_code, employee_code, title, day_offset, start, end)
SAMPLES = [
    ("ROOM-HQ-001", "EMP-003", "Sprint planning", 0, time(10, 0), time(11, 30)),
    ("ROOM-HQ-001", "EMP-007", "Client review", 0, time(14, 0), time(15, 0)),
    ("ROOM-HQ-002", "EMP-004", "1:1 sync", 0, time(11, 0), time(11, 45)),
    ("ROOM-HQ-003", "EMP-003", "All-hands prep", 1, time(9, 30), time(10, 30)),
    ("ROOM-HQ-002", "EMP-007", "Design huddle", 1, time(15, 0), time(16, 0)),
]


def utcnow() -> datetime:
    return datetime.now(timezone.utc)


def main() -> None:
    db = SessionLocal()
    try:
        tenant = db.scalar(select(SecTenant).where(SecTenant.tenant_code == "BOOTSTRAP"))
        company = (
            db.scalar(
                select(OrgCompany).where(
                    OrgCompany.tenant_id == tenant.id,
                    OrgCompany.company_code == "DEMOCO",
                    OrgCompany.is_deleted.is_(False),
                )
            )
            if tenant
            else None
        )
        admin = (
            db.scalar(
                select(SecUser).where(
                    SecUser.tenant_id == tenant.id,
                    SecUser.email == "admin@example.com",
                    SecUser.is_deleted.is_(False),
                )
            )
            if tenant
            else None
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
        if not tenant or not company or not admin or not branch:
            raise SystemExit("DEMOCO / HQ / admin missing — run seed_demo_data first")

        rooms = {
            r.room_code: r
            for r in db.scalars(
                select(HrTrainingRoom).where(
                    HrTrainingRoom.company_id == company.id,
                    HrTrainingRoom.is_deleted.is_(False),
                )
            ).all()
        }
        employees = {
            e.employee_code: e
            for e in db.scalars(
                select(MasterEmployee).where(
                    MasterEmployee.company_id == company.id,
                    MasterEmployee.is_deleted.is_(False),
                )
            ).all()
        }

        today = date.today()
        created = 0
        seq = 1
        for room_code, emp_code, title, day_offset, start, end in SAMPLES:
            room = rooms.get(room_code)
            emp = employees.get(emp_code)
            if not room or not emp:
                print(f"skip {room_code}/{emp_code} (missing room or employee)")
                continue
            on_date = today + timedelta(days=day_offset)
            request_code = f"ESS-MEET-{on_date.strftime('%Y%m%d')}-{seq:03d}"
            seq += 1
            existing = db.scalar(
                select(HrTrainingRequest).where(
                    HrTrainingRequest.company_id == company.id,
                    HrTrainingRequest.request_code == request_code,
                    HrTrainingRequest.is_deleted.is_(False),
                )
            )
            if existing:
                existing.title = title
                existing.room_id = room.id
                existing.request_date = on_date
                existing.start_time = start
                existing.end_time = end
                existing.status = "approved"
                existing.requested_by_employee_id = emp.id
                existing.host_employee_id = emp.id
                print(f"updated {request_code}")
                continue

            now = utcnow()
            db.add(
                HrTrainingRequest(
                    id=uuid4(),
                    tenant_id=tenant.id,
                    company_id=company.id,
                    branch_id=branch.id,
                    request_code=request_code,
                    title=title,
                    request_type="meeting",
                    requested_by_employee_id=emp.id,
                    host_employee_id=emp.id,
                    room_id=room.id,
                    request_date=on_date,
                    start_time=start,
                    end_time=end,
                    is_recurring=False,
                    attendees_json=[],
                    status="approved",
                    created_at=now,
                    updated_at=now,
                    created_by=admin.id,
                    updated_by=admin.id,
                )
            )
            created += 1
            print(f"created {request_code} {title}")

        db.commit()
        print(f"Done. created={created}")
    except Exception:
        db.rollback()
        raise
    finally:
        db.close()


if __name__ == "__main__":
    main()
