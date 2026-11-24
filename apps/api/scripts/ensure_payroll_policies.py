"""Ensure every company has an active DEFAULT payroll (salary configuration) policy.

Usage (from apps/api):
  .venv\\Scripts\\python.exe scripts/ensure_payroll_policies.py
"""

from __future__ import annotations

import sys
from datetime import date
from pathlib import Path

from dotenv import load_dotenv
from sqlalchemy import select

ROOT = Path(__file__).resolve().parents[1]
REPO = ROOT.parent.parent
sys.path.insert(0, str(ROOT / "src"))
load_dotenv(REPO / ".env", override=True)

from database.session import SessionLocal  # noqa: E402
from modules.foundation.models.security import SecTenant  # noqa: E402
from modules.organization.models.branch import OrgBranch  # noqa: E402
from modules.organization.models.company import OrgCompany  # noqa: E402
from modules.payroll.domain.payroll_policy_spec import default_company_payroll_policy_fields  # noqa: E402
from modules.payroll.models.payroll_policy import PayPayrollPolicy  # noqa: E402

_ = (OrgBranch, SecTenant)


def main() -> None:
    db = SessionLocal()
    try:
        companies = list(
            db.scalars(
                select(OrgCompany).where(OrgCompany.is_deleted.is_(False))
            ).all()
        )
        created = 0
        existing = 0
        for co in companies:
            row = db.scalar(
                select(PayPayrollPolicy).where(
                    PayPayrollPolicy.company_id == co.id,
                    PayPayrollPolicy.status == "active",
                    PayPayrollPolicy.is_deleted.is_(False),
                )
            )
            if row is not None:
                existing += 1
                continue
            fields = default_company_payroll_policy_fields()
            policy = PayPayrollPolicy(
                tenant_id=co.tenant_id,
                company_id=co.id,
                effective_from=date.today(),
                **fields,
            )
            db.add(policy)
            created += 1
            print(f"created DEFAULT for {co.company_name}")
        db.commit()
        print(f"created={created} already={existing} companies={len(companies)}")
        print("done")
    except Exception:
        db.rollback()
        raise
    finally:
        db.close()


if __name__ == "__main__":
    main()
