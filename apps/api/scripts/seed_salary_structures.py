"""Seed Cache Digitech salary components + graded salary structures.

Prereqs:
  - alembic upgrade head
  - python -m scripts.seed_demo_data

Usage (from apps/api):
  python -m scripts.seed_salary_structures
"""

from __future__ import annotations

import sys
from datetime import date
from decimal import Decimal
from pathlib import Path
from uuid import uuid4

from sqlalchemy import select

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT / "src"))

from database.session import SessionLocal  # noqa: E402
from modules.foundation.models.security import SecTenant, SecUser  # noqa: E402
from modules.organization.models.company import OrgCompany  # noqa: E402
from modules.payroll.models.salary_component import PaySalaryComponent  # noqa: E402
from modules.payroll.models.salary_structure import PaySalaryStructure  # noqa: E402
from modules.payroll.models.salary_structure_line import PaySalaryStructureLine  # noqa: E402

# component_code, name, class, taxable, statutory
COMPONENTS = [
    ("BASIC", "Basic", "earning", True, False),
    ("HRA", "HRA", "earning", True, False),
    ("SPECIAL", "Special Allowance", "earning", True, False),
    ("MEDICAL", "Medical", "earning", True, False),
    ("CONVEYANCE", "Conveyance", "earning", True, False),
    ("LTA", "LTA", "earning", True, False),
    ("BONUS", "Bonus", "earning", True, False),
    ("EMPR_PF", "Employer PF", "employer_contribution", False, True),
    ("EE_PF", "Employee PF", "deduction", False, True),
    ("PT", "Professional Tax", "deduction", False, True),
    ("ESI", "ESI", "deduction", False, True),
    ("ITAX", "Income Tax", "deduction", False, True),
    ("GRATUITY", "Gratuity", "employer_contribution", False, True),
]

# Monthly amounts: basic, hra, special, medical, conveyance, ee_pf, pt, itax
STRUCTURES = [
    ("SS-INTERN", "Intern Structure", 10000, 4000, 2500, 500, 1000, 1200, 0, 0),
    ("SS-JUNIOR", "Junior Structure", 18000, 7200, 4500, 1250, 1600, 1800, 200, 500),
    ("SS-ENG", "Engineer Structure", 35000, 14000, 10000, 1250, 2400, 1800, 200, 3500),
    ("SS-SENIOR", "Senior Engineer Structure", 55000, 22000, 18000, 2500, 3200, 1800, 200, 8000),
    ("SS-LEAD", "Lead Structure", 75000, 30000, 28000, 3000, 4000, 1800, 200, 14000),
    ("SS-MGR", "Manager Structure", 100000, 40000, 40000, 4000, 5000, 1800, 200, 22000),
    ("SS-DIR", "Director Structure", 150000, 60000, 70000, 5000, 8000, 1800, 200, 40000),
    ("SS-EXEC", "Executive Structure", 220000, 88000, 120000, 8000, 12000, 1800, 200, 70000),
]


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
        for k, v in defaults.items():
            if v is not None and hasattr(row, k):
                setattr(row, k, v)
        db.flush()
        return row
    valid = {c.key for c in model.__table__.columns}
    payload = {**unique, **{k: v for k, v in defaults.items() if v is not None and k in valid}}
    payload = {k: v for k, v in payload.items() if k in valid}
    row = model(id=uuid4(), **payload)
    db.add(row)
    db.flush()
    return row


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
        ) if tenant else None
        admin = db.scalar(
            select(SecUser).where(
                SecUser.tenant_id == tenant.id,
                SecUser.email == "admin@example.com",
                SecUser.is_deleted.is_(False),
            )
        ) if tenant else None
        if not tenant or not company or not admin:
            raise SystemExit("DEMOCO / admin missing — run seed_demo_data first")

        tid, cid, aid = tenant.id, company.id, admin.id

        print("Seeding salary components…")
        comps: dict[str, PaySalaryComponent] = {}
        for code, name, cls, taxable, statutory in COMPONENTS:
            comps[code] = ensure(
                db,
                PaySalaryComponent,
                {"tenant_id": tid, "company_id": cid, "component_code": code},
                {
                    "component_name": name,
                    "component_class": cls,
                    "calculation_method": "fixed",
                    "is_taxable": taxable,
                    "is_statutory": statutory,
                    "status": "active",
                    "created_by": aid,
                    "updated_by": aid,
                },
            )

        # Soft-retire legacy Standard Structure so UI doesn't show duplicates
        legacy = get_one(db, PaySalaryStructure, company_id=cid, structure_code="SS-STD")
        if legacy and not legacy.is_deleted:
            legacy.structure_name = "Standard Structure (legacy)"
            legacy.status = "inactive"
            print("Marked SS-STD inactive")

        print("Seeding graded salary structures…")
        line_map = [
            ("BASIC", 0),
            ("HRA", 1),
            ("SPECIAL", 2),
            ("MEDICAL", 3),
            ("CONVEYANCE", 4),
            ("EE_PF", 5),
            ("PT", 6),
            ("ITAX", 7),
        ]
        for row in STRUCTURES:
            code, name, *amounts = row
            structure = ensure(
                db,
                PaySalaryStructure,
                {"tenant_id": tid, "company_id": cid, "structure_code": code},
                {
                    "structure_name": name,
                    "effective_from": date(2025, 4, 1),
                    "currency_code": "INR",
                    "status": "active",
                    "created_by": aid,
                    "updated_by": aid,
                },
            )
            for seq, (comp_code, amt_idx) in enumerate(line_map, start=1):
                amount = Decimal(str(amounts[amt_idx]))
                ensure(
                    db,
                    PaySalaryStructureLine,
                    {
                        "tenant_id": tid,
                        "company_id": cid,
                        "salary_structure_id": structure.id,
                        "salary_component_id": comps[comp_code].id,
                    },
                    {
                        "sequence_no": seq,
                        "default_amount": amount,
                        "is_mandatory": True,
                        "status": "active",
                        "created_by": aid,
                        "updated_by": aid,
                    },
                )
            print(f"  {code} — {name}")

        db.commit()
        print(f"Done. Components={len(comps)} Structures={len(STRUCTURES)}")
    except Exception:
        db.rollback()
        raise
    finally:
        db.close()


if __name__ == "__main__":
    main()
