"""Seed demo meeting / training rooms for Cache Digitech.

Prereqs: seed_demo_data (DEMOCO + MUM/SUL branches)

Usage (from apps/api):
  python -m scripts.seed_training_rooms
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
from modules.foundation.models.security import SecTenant, SecUser  # noqa: E402
from modules.hr.models.training_room import HrTrainingRoom  # noqa: E402
from modules.organization.models.branch import OrgBranch  # noqa: E402
from modules.organization.models.company import OrgCompany  # noqa: E402

ROOMS = [
    ("ROOM-001", "Innovation Lab", "MUM", 24, ["Projector", "Whiteboard", "Video Conferencing", "Wi-Fi", "AC"]),
    ("ROOM-002", "Board Room", "MUM", 12, ["Video Conferencing", "TV Display", "Speakerphone", "AC"]),
    ("ROOM-003", "Training Hall A", "MUM", 40, ["Projector", "Microphone", "Sound System", "Wi-Fi", "AC"]),
    ("ROOM-004", "Huddle Pod 1", "MUM", 6, ["TV Display", "Whiteboard", "Wi-Fi"]),
    ("ROOM-005", "Delhi Conference", "SUL", 16, ["Projector", "Video Conferencing", "Whiteboard", "AC"]),
    ("ROOM-006", "Sultanpur Training Room", "SUL", 30, ["Projector", "Sound System", "Wi-Fi", "AC"]),
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
        if not tenant or not company or not admin:
            raise SystemExit("DEMOCO / admin missing — run seed_demo_data first")

        branches = {
            b.branch_code: b
            for b in db.scalars(
                select(OrgBranch).where(
                    OrgBranch.company_id == company.id,
                    OrgBranch.is_deleted.is_(False),
                )
            ).all()
        }

        created = 0
        for code, name, branch_code, capacity, features in ROOMS:
            branch = branches.get(branch_code)
            existing = db.scalar(
                select(HrTrainingRoom).where(
                    HrTrainingRoom.company_id == company.id,
                    HrTrainingRoom.room_code == code,
                    HrTrainingRoom.is_deleted.is_(False),
                )
            )
            if existing:
                existing.room_name = name
                existing.capacity = capacity
                existing.equipment_json = features
                existing.branch_id = branch.id if branch else existing.branch_id
                existing.status = "active"
                print(f"updated {code}")
            else:
                now = utcnow()
                db.add(
                    HrTrainingRoom(
                        id=uuid4(),
                        tenant_id=tenant.id,
                        company_id=company.id,
                        branch_id=branch.id if branch else None,
                        room_code=code,
                        room_name=name,
                        capacity=capacity,
                        equipment_json=features,
                        notes=f"{name} at {branch.branch_name if branch else 'HQ'}",
                        status="active",
                        created_at=now,
                        updated_at=now,
                        created_by=admin.id,
                        updated_by=admin.id,
                    )
                )
                created += 1
                print(f"created {code}")

        db.commit()
        print(f"Done. created={created} total={len(ROOMS)}")
    except Exception:
        db.rollback()
        raise
    finally:
        db.close()


if __name__ == "__main__":
    main()
