"""Seed platform / tenant admin logins for /admin-login.

Creates or repairs:
  - admin@example.com / Secure1!  (super_admin)
  - tenant.admin@example.com / Secure1!  (tenant_admin)

Uses the BOOTSTRAP tenant. Soft-deletes conflicting non-admin rows with the
same email so login resolves the admin account.

Usage (from apps/api):
  python -m scripts.seed_admin_login
"""

from __future__ import annotations

import sys
from datetime import datetime, timezone
from pathlib import Path
from uuid import uuid4

from sqlalchemy import select, text

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT))
sys.path.insert(0, str(ROOT / "src"))

from database.session import SessionLocal  # noqa: E402
from modules.foundation.models.security import (  # noqa: E402
    SecRole,
    SecTenant,
    SecUser,
    SecUserRole,
)
from modules.foundation.service.user_service import UserService  # noqa: E402
from security.password import PasswordHasher  # noqa: E402

DEMO_PASSWORD = "Secure1!"

ADMIN_SPECS = [
    {
        "email": "admin@example.com",
        "display_name": "Platform Admin",
        "user_type": "super_admin",
        "role_code": "SUPER_ADMIN",
        "role_name": "Super Admin",
    },
    {
        "email": "tenant.admin@example.com",
        "display_name": "Tenant Admin",
        "user_type": "tenant_admin",
        "role_code": "TENANT_ADMIN",
        "role_name": "Tenant Admin",
    },
]


def utcnow() -> datetime:
    return datetime.now(timezone.utc)


def get_or_create_bootstrap_tenant(db) -> SecTenant:
    tenant = db.scalar(select(SecTenant).where(SecTenant.tenant_code == "BOOTSTRAP"))
    if tenant:
        return tenant
    tenant = SecTenant(
        id=uuid4(),
        tenant_code="BOOTSTRAP",
        tenant_name="Bootstrap Demo Tenant",
        status="active",
        timezone="UTC",
        locale="en",
    )
    db.add(tenant)
    db.flush()
    return tenant


def ensure_role(db, tenant_id, role_code: str, role_name: str) -> SecRole:
    role = db.scalar(
        select(SecRole).where(
            SecRole.tenant_id == tenant_id,
            SecRole.role_code == role_code,
            SecRole.is_deleted.is_(False),
        )
    )
    if role:
        return role
    role = SecRole(
        id=uuid4(),
        tenant_id=tenant_id,
        role_code=role_code,
        role_name=role_name,
        is_system_role=True,
        status="active",
    )
    db.add(role)
    db.flush()
    return role


def grant_all_permissions(db, tenant_id, role_id) -> None:
    db.execute(
        text(
            """
            INSERT INTO foundation.sec_role_permission (
                id, tenant_id, role_id, permission_id, granted_at
            )
            SELECT gen_random_uuid(), :tenant_id, :role_id, p.id, NOW()
            FROM foundation.sec_permission p
            WHERE p.is_active = true
              AND NOT EXISTS (
                SELECT 1 FROM foundation.sec_role_permission rp
                WHERE rp.role_id = :role_id AND rp.permission_id = p.id
              )
            """
        ),
        {"tenant_id": str(tenant_id), "role_id": str(role_id)},
    )


def soft_delete_conflicting_emails(db, emails: list[str], keep_tenant_id) -> int:
    """Soft-delete active non-admin duplicates so login resolves the admin row."""
    removed = 0
    for email in emails:
        rows = db.scalars(
            select(SecUser).where(
                SecUser.email == email,
                SecUser.is_deleted.is_(False),
            )
        ).all()
        for row in rows:
            is_keep_admin = row.tenant_id == keep_tenant_id and row.user_type in {
                "super_admin",
                "tenant_admin",
            }
            if is_keep_admin:
                continue
            row.is_deleted = True
            row.updated_at = utcnow()
            removed += 1
    return removed


def upsert_admin(db, tenant: SecTenant, spec: dict, password_hash: str) -> SecUser:
    service = UserService(db)
    role = ensure_role(db, tenant.id, spec["role_code"], spec["role_name"])
    grant_all_permissions(db, tenant.id, role.id)

    # Prefer an existing row on this tenant (including soft-deleted).
    existing = db.scalar(
        select(SecUser)
        .where(
            SecUser.tenant_id == tenant.id,
            SecUser.email == spec["email"],
        )
        .order_by(SecUser.is_deleted.asc(), SecUser.created_at.desc())
    )

    if existing:
        existing.is_deleted = False
        existing.status = "active"
        existing.user_type = spec["user_type"]
        existing.display_name = spec["display_name"]
        existing.password_hash = password_hash
        existing.failed_login_count = 0
        existing.locked_until = None
        existing.must_change_password = False
        existing.updated_at = utcnow()
        user = existing
    else:
        created = service.create_user(
            tenant_id=tenant.id,
            email=spec["email"],
            password=DEMO_PASSWORD,
            display_name=spec["display_name"],
            user_type=spec["user_type"],
            created_by=None,
        )
        user = db.scalar(select(SecUser).where(SecUser.id == created.id))
        assert user is not None
        user.password_hash = password_hash
        user.must_change_password = False

    already = db.scalar(
        select(SecUserRole).where(
            SecUserRole.user_id == user.id,
            SecUserRole.role_id == role.id,
        )
    )
    if not already:
        service.assign_role(
            tenant_id=tenant.id,
            user_id=user.id,
            role_id=role.id,
            assigned_by=None,
        )
    return user


def main() -> None:
    password_hash = PasswordHasher.hash_password(DEMO_PASSWORD)
    db = SessionLocal()
    try:
        tenant = get_or_create_bootstrap_tenant(db)
        emails = [s["email"] for s in ADMIN_SPECS]
        removed = soft_delete_conflicting_emails(db, emails, tenant.id)
        users = [upsert_admin(db, tenant, spec, password_hash) for spec in ADMIN_SPECS]
        # Soft-delete any remaining active duplicates of these emails.
        for email in emails:
            for row in db.scalars(
                select(SecUser).where(
                    SecUser.email == email,
                    SecUser.is_deleted.is_(False),
                )
            ).all():
                keep = next((u for u in users if u.id == row.id), None)
                if keep is None:
                    row.is_deleted = True
                    row.updated_at = utcnow()
                    removed += 1
        db.commit()

        print("=" * 60)
        print("Admin login seeded")
        print("=" * 60)
        print(f"Database    : localhost:5433 / erp (PostgreSQL)")
        print(f"Tenant      : {tenant.tenant_code} ({tenant.id})")
        print(f"Password    : {DEMO_PASSWORD}")
        print(f"Conflicts soft-deleted: {removed}")
        print("-" * 60)
        for user in users:
            print(f"  {user.display_name:<18} {user.email:<32} {user.user_type}")
        print("=" * 60)
        print("Sign in at: http://localhost:3000/admin-login")
        print(f'  {{"email":"admin@example.com","password":"{DEMO_PASSWORD}"}}')
    except Exception:
        db.rollback()
        raise
    finally:
        db.close()


if __name__ == "__main__":
    main()
