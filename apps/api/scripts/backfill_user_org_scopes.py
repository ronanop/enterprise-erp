"""Assign default org company/branch scope to users missing sec_user_org_scope.

Usage (from apps/api):
  .venv\\Scripts\\python.exe -m scripts.backfill_user_org_scopes
"""

from __future__ import annotations

import sys
from pathlib import Path

from sqlalchemy import select

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT / "src"))

from database.session import SessionLocal  # noqa: E402
from modules.foundation.models.security import SecTenant, SecUser  # noqa: E402
from modules.foundation.service.org_context_service import OrgContextService  # noqa: E402


def main() -> None:
    db = SessionLocal()
    try:
        tenant = db.scalar(select(SecTenant).where(SecTenant.tenant_code == "BOOTSTRAP"))
        if not tenant:
            raise SystemExit("BOOTSTRAP tenant not found")

        org = OrgContextService(db)
        company, branch = org.get_tenant_primary_org(tenant.id)
        if company is None:
            raise SystemExit("No org company — run seed_demo_data first")

        users = db.scalars(
            select(SecUser).where(
                SecUser.tenant_id == tenant.id,
                SecUser.is_deleted.is_(False),
            )
        ).all()
        assigned = 0
        for user in users:
            before = org._scopes.get_default_scope(user.id, tenant.id)  # noqa: SLF001
            if before:
                continue
            org.ensure_default_scope(
                tenant_id=tenant.id,
                user_id=user.id,
                company_id=company.id,
                branch_id=branch.id if branch else None,
            )
            assigned += 1

        print(f"Default org scope: company={company.company_code}, branch={branch.branch_code if branch else '—'}")
        print(f"Users checked: {len(users)}, newly assigned: {assigned}")
    finally:
        db.close()


if __name__ == "__main__":
    main()
