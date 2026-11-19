"""Seed core leave types with max_days_per_year + monthly_credit_days."""

from __future__ import annotations

import sys
from decimal import Decimal
from pathlib import Path
from uuid import uuid4

from sqlalchemy import select

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT / "src"))

from database.session import SessionLocal  # noqa: E402
from modules.foundation.models.security import SecTenant, SecUser  # noqa: E402
from modules.hr.models.leave_type import HrLeaveType  # noqa: E402
from modules.organization.models.company import OrgCompany  # noqa: E402

TYPES = [
    ("CL", "Casual Leave", Decimal("12"), Decimal("1"), True, False),
    ("SL", "Sick Leave", Decimal("10"), Decimal("1"), True, True),
    ("EL", "Earned Leave", Decimal("18"), Decimal("1.5"), True, False),
    ("ML", "Maternity Leave", Decimal("182"), None, True, False),
    ("PL", "Paternity Leave", Decimal("15"), None, True, False),
    ("LOP", "Loss of Pay", Decimal("0"), None, False, False),
    ("CO", "Comp Off", Decimal("0"), None, True, False),
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
        if not tenant or not company or not admin:
            raise SystemExit("DEMOCO / admin missing — run seed_demo_data first")

        for code, name, year, month, paid, attach in TYPES:
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
                    leave_type_code=code,
                    leave_type_name=name,
                    is_paid=paid,
                    max_days_per_year=year,
                    monthly_credit_days=month,
                    requires_attachment=attach,
                    status="active",
                    created_by=admin.id,
                    updated_by=admin.id,
                )
                db.add(row)
                print(f"created {code}")
            else:
                row.leave_type_name = name
                row.is_paid = paid
                row.max_days_per_year = year
                row.monthly_credit_days = month
                row.requires_attachment = attach
                row.status = "active"
                row.updated_by = admin.id
                print(f"updated {code}")
        db.commit()
        print("leave types seeded")
    except Exception:
        db.rollback()
        raise
    finally:
        db.close()


if __name__ == "__main__":
    main()
