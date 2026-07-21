"""Seed every module permission and grant them to demo admin roles.

This fixes "Missing permission: …" across all departments for local testing.

Usage (from apps/api):
  .venv\\Scripts\\python.exe -m scripts.seed_all_permissions
"""

from __future__ import annotations

import sys
from datetime import datetime, timezone
from pathlib import Path
from uuid import uuid4

from sqlalchemy import select, text

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT / "src"))

from database.session import SessionLocal  # noqa: E402
from modules.analytics.permissions import ANALYTICS_PERMISSIONS  # noqa: E402
from modules.asset.permissions import ASSET_PERMISSIONS  # noqa: E402
from modules.crm.permissions import CRM_PERMISSIONS  # noqa: E402
from modules.document.permissions import DOCUMENT_PERMISSIONS  # noqa: E402
from modules.ecommerce.permissions import ECOMMERCE_PERMISSIONS  # noqa: E402
from modules.finance.permissions import FINANCE_PERMISSIONS  # noqa: E402
from modules.foundation.models.security import SecRole, SecTenant, SecUser  # noqa: E402
from modules.foundation.permissions import FOUNDATION_PERMISSIONS  # noqa: E402
from modules.foundation.service.rbac_service import RBACService  # noqa: E402
from modules.grc.permissions import GRC_PERMISSIONS  # noqa: E402
from modules.helpdesk.permissions import HELPDESK_PERMISSIONS  # noqa: E402
from modules.hr.permissions import HR_PERMISSIONS  # noqa: E402
from modules.integration.permissions import INTEGRATION_PERMISSIONS  # noqa: E402
from modules.inventory.permissions import INV_PERMISSIONS  # noqa: E402
from modules.manufacturing.permissions import MFG_PERMISSIONS  # noqa: E402
from modules.master_data.permissions import MASTER_PERMISSIONS  # noqa: E402
from modules.organization.permissions import ORGANIZATION_PERMISSIONS  # noqa: E402
from modules.payroll.permissions import PAYROLL_PERMISSIONS  # noqa: E402
from modules.portal.permissions import PORTAL_PERMISSIONS  # noqa: E402
from modules.procurement.permissions import PROC_PERMISSIONS  # noqa: E402
from modules.project.permissions import PROJECT_PERMISSIONS  # noqa: E402
from modules.quality.permissions import QM_PERMISSIONS  # noqa: E402
from modules.recruitment.permissions import RECRUITMENT_PERMISSIONS  # noqa: E402
from modules.sales.permissions import SALES_PERMISSIONS  # noqa: E402
from modules.service.permissions import SERVICE_PERMISSIONS  # noqa: E402

ALL_PERMISSION_SETS: list[tuple[str, list[tuple[str, str, str, str]]]] = [
    ("foundation", FOUNDATION_PERMISSIONS),
    ("organization", ORGANIZATION_PERMISSIONS),
    ("master_data", MASTER_PERMISSIONS),
    ("finance", FINANCE_PERMISSIONS),
    ("sales", SALES_PERMISSIONS),
    ("procurement", PROC_PERMISSIONS),
    ("inventory", INV_PERMISSIONS),
    ("manufacturing", MFG_PERMISSIONS),
    ("quality", QM_PERMISSIONS),
    ("crm", CRM_PERMISSIONS),
    ("hr", HR_PERMISSIONS),
    ("payroll", PAYROLL_PERMISSIONS),
    ("recruitment", RECRUITMENT_PERMISSIONS),
    ("project", PROJECT_PERMISSIONS),
    ("asset", ASSET_PERMISSIONS),
    ("service", SERVICE_PERMISSIONS),
    ("helpdesk", HELPDESK_PERMISSIONS),
    ("document", DOCUMENT_PERMISSIONS),
    ("grc", GRC_PERMISSIONS),
    ("analytics", ANALYTICS_PERMISSIONS),
    ("integration", INTEGRATION_PERMISSIONS),
    ("ecommerce", ECOMMERCE_PERMISSIONS),
    ("portal", PORTAL_PERMISSIONS),
]

DEMO_ROLE_CODES = ("SUPER_ADMIN", "TENANT_ADMIN")


def utcnow() -> datetime:
    return datetime.now(timezone.utc)


def ensure_permissions(db) -> dict[str, str]:
    """Upsert all module permissions. Returns permission_code -> id."""
    now = utcnow()
    mapping: dict[str, str] = {}
    inserted = 0

    for _module_name, perms in ALL_PERMISSION_SETS:
        for code, resource, action, module in perms:
            row = db.execute(
                text(
                    "SELECT id FROM foundation.sec_permission WHERE permission_code = :code"
                ),
                {"code": code},
            ).first()
            if row:
                mapping[code] = str(row[0])
                continue
            perm_id = str(uuid4())
            db.execute(
                text(
                    """
                    INSERT INTO foundation.sec_permission
                    (id, permission_code, resource, action, description, module, is_active, created_at)
                    VALUES (:id, :code, :resource, :action, NULL, :module, true, :now)
                    """
                ),
                {
                    "id": perm_id,
                    "code": code,
                    "resource": resource,
                    "action": action,
                    "module": module,
                    "now": now,
                },
            )
            mapping[code] = perm_id
            inserted += 1

    print(f"Permissions upserted. new={inserted} total={len(mapping)}")
    return mapping


def ensure_role(db, tenant_id, role_code: str, role_name: str) -> str:
    role = db.scalar(
        select(SecRole).where(
            SecRole.tenant_id == tenant_id,
            SecRole.role_code == role_code,
            SecRole.is_deleted.is_(False),
        )
    )
    if role:
        return str(role.id)
    role_id = str(uuid4())
    db.execute(
        text(
            """
            INSERT INTO foundation.sec_role
            (id, tenant_id, role_code, role_name, is_system_role, status,
             created_at, updated_at, is_deleted, version)
            VALUES (:id, :tid, :code, :name, true, 'active', :now, :now, false, 1)
            """
        ),
        {
            "id": role_id,
            "tid": str(tenant_id),
            "code": role_code,
            "name": role_name,
            "now": utcnow(),
        },
    )
    return role_id


def grant_all_to_roles(db, tenant_id, role_ids: list[str], perm_ids: list[str]) -> int:
    granted = 0
    now = utcnow()
    for role_id in role_ids:
        for perm_id in perm_ids:
            exists = db.execute(
                text(
                    """
                    SELECT 1 FROM foundation.sec_role_permission
                    WHERE role_id = :rid AND permission_id = :pid
                    """
                ),
                {"rid": role_id, "pid": perm_id},
            ).first()
            if exists:
                continue
            db.execute(
                text(
                    """
                    INSERT INTO foundation.sec_role_permission
                    (id, tenant_id, role_id, permission_id, granted_at)
                    VALUES (:id, :tid, :rid, :pid, :now)
                    """
                ),
                {
                    "id": str(uuid4()),
                    "tid": str(tenant_id),
                    "rid": role_id,
                    "pid": perm_id,
                    "now": now,
                },
            )
            granted += 1
    return granted


def invalidate_user_caches(db, tenant_id) -> None:
    rbac = RBACService(db)
    users = db.scalars(
        select(SecUser).where(SecUser.tenant_id == tenant_id, SecUser.is_deleted.is_(False))
    ).all()
    for user in users:
        rbac.invalidate_user(user.id)
    print(f"Invalidated permission cache for {len(users)} users")


def main() -> None:
    db = SessionLocal()
    try:
        tenant = db.scalar(select(SecTenant).where(SecTenant.tenant_code == "BOOTSTRAP"))
        if tenant is None:
            raise RuntimeError("BOOTSTRAP tenant not found. Run scripts.seed_demo_data first.")

        perm_map = ensure_permissions(db)
        role_ids = [
            ensure_role(db, tenant.id, "SUPER_ADMIN", "Super Admin"),
            ensure_role(db, tenant.id, "TENANT_ADMIN", "Tenant Admin"),
        ]
        granted = grant_all_to_roles(db, tenant.id, role_ids, list(perm_map.values()))
        db.commit()

        invalidate_user_caches(db, tenant.id)
        db.commit()

        by_module = db.execute(
            text(
                """
                SELECT module, COUNT(*)
                FROM foundation.sec_permission
                WHERE is_active = true
                GROUP BY module
                ORDER BY module
                """
            )
        ).all()

        print("=" * 60)
        print("All-module permissions seeded and granted")
        print(f"Tenant        : {tenant.id}")
        print(f"Roles         : {', '.join(DEMO_ROLE_CODES)}")
        print(f"New grants    : {granted}")
        print("Permission counts by module:")
        for module, count in by_module:
            print(f"  - {module:<16} {count}")
        print("=" * 60)
        print("Sign out and sign in again on the website so the session reloads permissions.")
    except Exception:
        db.rollback()
        raise
    finally:
        db.close()


if __name__ == "__main__":
    main()
