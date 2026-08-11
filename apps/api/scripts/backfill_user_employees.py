"""Backfill master_employee rows for active sec_user accounts (Entra / org users)."""

from __future__ import annotations

import sys
from pathlib import Path

from sqlalchemy import select

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT / "src"))

from database.session import SessionLocal  # noqa: E402
from modules.foundation.domain.value_objects import TenantContext  # noqa: E402
from modules.foundation.models.security import SecTenant, SecUser  # noqa: E402
from modules.foundation.service.org_context_service import OrgContextService  # noqa: E402
from modules.foundation.service.user_employee_link_service import UserEmployeeLinkService  # noqa: E402


def main() -> None:
    db = SessionLocal()
    try:
        tenant = db.scalar(select(SecTenant).where(SecTenant.tenant_code == "BOOTSTRAP"))
        if tenant is None:
            raise SystemExit("BOOTSTRAP tenant not found")

        org = OrgContextService(db)
        linker = UserEmployeeLinkService(db)
        primary_company, primary_branch = org.get_tenant_primary_org(tenant.id)

        users = db.scalars(
            select(SecUser).where(
                SecUser.tenant_id == tenant.id,
                SecUser.is_deleted.is_(False),
                SecUser.status == "active",
            )
        ).all()

        created = 0
        linked = 0
        for user in users:
            email = (user.email or "").strip().lower()
            if email.endswith("@example.com"):
                continue
            ctx = TenantContext(
                tenant_id=tenant.id,
                user_id=user.id,
                user_type=user.user_type,
                company_id=primary_company.id if primary_company else None,
                branch_id=primary_branch.id if primary_branch else None,
            )
            before = linker.find_employee_for_user(ctx, user)
            after = linker.ensure_employee_for_user(ctx, user)
            if after is None:
                continue
            if before is None:
                created += 1
            else:
                linked += 1

        db.commit()
        print(f"Employee link backfill: {created} created, {linked} already linked.")
    except Exception:
        db.rollback()
        raise
    finally:
        db.close()


if __name__ == "__main__":
    main()
