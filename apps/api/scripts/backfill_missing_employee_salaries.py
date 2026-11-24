"""Create pay_employee_salary rows for personal SS-{CODE} structures that never got assigned.

Bulk import often created the structure under the active company but failed assign when
the employee belongs to another legal entity. This script assigns using the employee's
own company / branch / employment.

Usage (from apps/api):
  .venv\\Scripts\\python.exe scripts/backfill_missing_employee_salaries.py
"""

from __future__ import annotations

import sys
from datetime import date
from decimal import Decimal
from pathlib import Path
from uuid import uuid4

from dotenv import load_dotenv
from sqlalchemy import select, text

ROOT = Path(__file__).resolve().parents[1]
REPO = ROOT.parent.parent
sys.path.insert(0, str(ROOT / "src"))
load_dotenv(REPO / ".env", override=True)

from database.session import SessionLocal  # noqa: E402
from modules.hr.models.employment import HrEmployment  # noqa: E402
from modules.master_data.models.employee import MasterEmployee  # noqa: E402
from modules.organization.models.branch import OrgBranch  # noqa: E402
from modules.organization.models.company import OrgCompany  # noqa: E402
from modules.payroll.models.employee_salary import PayEmployeeSalary  # noqa: E402
from modules.payroll.models.salary_structure import PaySalaryStructure  # noqa: E402

_ = (OrgCompany, OrgBranch)


def main() -> None:
    db = SessionLocal()
    try:
        structures = list(
            db.scalars(
                select(PaySalaryStructure).where(
                    PaySalaryStructure.is_deleted.is_(False),
                    PaySalaryStructure.structure_code.ilike("SS-%"),
                )
            ).all()
        )
        employees = {
            str(e.employee_code or "").strip().upper(): e
            for e in db.scalars(
                select(MasterEmployee).where(MasterEmployee.is_deleted.is_(False))
            ).all()
        }
        assigned_emp_ids = {
            row.employee_id
            for row in db.scalars(
                select(PayEmployeeSalary).where(PayEmployeeSalary.is_deleted.is_(False))
            ).all()
        }

        created = 0
        skipped = 0
        for struct in structures:
            code = str(struct.structure_code or "").strip().upper()
            if not code.startswith("SS-"):
                continue
            emp_code = code[3:].strip()
            emp = employees.get(emp_code)
            if emp is None:
                skipped += 1
                print(f"skip_no_employee {code}")
                continue
            if emp.id in assigned_emp_ids:
                skipped += 1
                continue

            employment = db.scalar(
                select(HrEmployment).where(
                    HrEmployment.employee_id == emp.id,
                    HrEmployment.is_deleted.is_(False),
                )
            )
            if employment is None:
                if not emp.branch_id or not emp.company_id:
                    skipped += 1
                    print(f"skip_no_employment {emp_code}")
                    continue
                employment = HrEmployment(
                    id=uuid4(),
                    tenant_id=emp.tenant_id,
                    company_id=emp.company_id,
                    branch_id=emp.branch_id,
                    employee_id=emp.id,
                    employment_type="permanent",
                    date_of_joining=emp.date_of_joining or date.today(),
                    payroll_eligible=True,
                    lifecycle_source="salary_backfill",
                    status="active",
                    document_number=f"EMPL-BF-{emp_code}"[:40],
                )
                db.add(employment)
                db.flush()

            gross = Decimal(str(struct.gross_ctc or struct.ctc_amount or 0))
            if gross <= 0:
                skipped += 1
                print(f"skip_zero_ctc {emp_code}")
                continue

            row = PayEmployeeSalary(
                id=uuid4(),
                tenant_id=emp.tenant_id,
                company_id=emp.company_id,
                branch_id=emp.branch_id,
                employee_id=emp.id,
                employment_id=employment.id,
                department_id=emp.department_id,
                salary_structure_id=struct.id,
                effective_from=date.today(),
                ctc_amount=gross * Decimal("12"),
                gross_amount=gross,
                currency_code="INR",
                status="active",
                document_number=f"ESAL-BF-{emp_code}"[:40],
            )
            db.add(row)
            assigned_emp_ids.add(emp.id)
            created += 1
            print(f"created {emp_code} gross={gross}")

        db.commit()
        total = db.execute(
            text(
                "SELECT count(*) FROM payroll.pay_employee_salary WHERE is_deleted=false AND status='active'"
            )
        ).scalar()
        print(f"created={created} skipped={skipped} active_salaries={total}")
        print("done")
    except Exception:
        db.rollback()
        raise
    finally:
        db.close()


if __name__ == "__main__":
    main()
