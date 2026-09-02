"""Limit deevenshu@cachedigitech.com to CRM, Procurement, and Projects modules."""

from __future__ import annotations

import sys
from datetime import datetime, timezone
from uuid import uuid4

sys.path.insert(0, "src")

from sqlalchemy import create_engine, text

from core.config import settings

EMAIL = "deevenshu@cachedigitech.com"
KEEP_MODULES = ("crm", "procurement", "projects")
ADMIN_ROLES = ("SUPER_ADMIN", "TENANT_ADMIN")


def main() -> None:
    engine = create_engine(str(settings.database_url))
    now = datetime.now(timezone.utc)

    with engine.begin() as conn:
        user = conn.execute(
            text(
                """
                select id::text, tenant_id::text, email, user_type, display_name
                from foundation.sec_user
                where lower(email) = lower(:email) and is_deleted = false
                """
            ),
            {"email": EMAIL},
        ).fetchone()

        if user is None:
            print(f"User not found: {EMAIL}")
            return

        print(
            f"Found user {user.email} ({user.display_name}) "
            f"id={user.id} type={user.user_type} tenant={user.tenant_id}"
        )

        roles_before = conn.execute(
            text(
                """
                select r.role_code
                from foundation.sec_user_role ur
                join foundation.sec_role r on r.id = ur.role_id
                where ur.user_id = cast(:uid as uuid)
                order by r.role_code
                """
            ),
            {"uid": user.id},
        ).fetchall()
        print("roles before:", [r[0] for r in roles_before] or "none")

        modules_before = conn.execute(
            text(
                """
                select module_key, role
                from foundation.sec_user_module
                where user_id = cast(:uid as uuid)
                order by module_key
                """
            ),
            {"uid": user.id},
        ).fetchall()
        print("modules before:", [(m[0], m[1]) for m in modules_before] or "none")

        # Demote platform admin user type
        conn.execute(
            text(
                """
                update foundation.sec_user
                set user_type = 'employee',
                    updated_at = :now
                where id = cast(:uid as uuid)
                """
            ),
            {"uid": user.id, "now": now},
        )

        # Remove SUPER_ADMIN / TENANT_ADMIN role links
        removed_roles = conn.execute(
            text(
                """
                delete from foundation.sec_user_role ur
                using foundation.sec_role r
                where ur.role_id = r.id
                  and ur.user_id = cast(:uid as uuid)
                  and upper(r.role_code) = any(:codes)
                """
            ),
            {"uid": user.id, "codes": list(ADMIN_ROLES)},
        ).rowcount
        print(f"removed admin role links: {removed_roles}")

        # Replace module assignments
        deleted_mods = conn.execute(
            text(
                """
                delete from foundation.sec_user_module
                where user_id = cast(:uid as uuid)
                """
            ),
            {"uid": user.id},
        ).rowcount
        print(f"cleared module rows: {deleted_mods}")

        for key in KEEP_MODULES:
            conn.execute(
                text(
                    """
                    insert into foundation.sec_user_module (
                      id, tenant_id, user_id, module_key, role, assigned_at, assigned_by
                    )
                    values (
                      cast(:id as uuid),
                      cast(:tenant as uuid),
                      cast(:uid as uuid),
                      :module_key,
                      'admin',
                      :now,
                      null
                    )
                    """
                ),
                {
                    "id": str(uuid4()),
                    "tenant": user.tenant_id,
                    "uid": user.id,
                    "module_key": key,
                    "now": now,
                },
            )

        # Verify
        after = conn.execute(
            text(
                """
                select user_type from foundation.sec_user
                where id = cast(:uid as uuid)
                """
            ),
            {"uid": user.id},
        ).scalar()
        modules_after = conn.execute(
            text(
                """
                select module_key, role
                from foundation.sec_user_module
                where user_id = cast(:uid as uuid)
                order by module_key
                """
            ),
            {"uid": user.id},
        ).fetchall()
        roles_after = conn.execute(
            text(
                """
                select r.role_code
                from foundation.sec_user_role ur
                join foundation.sec_role r on r.id = ur.role_id
                where ur.user_id = cast(:uid as uuid)
                order by r.role_code
                """
            ),
            {"uid": user.id},
        ).fetchall()

        print("user_type after:", after)
        print("modules after:", [(m[0], m[1]) for m in modules_after])
        print("roles after:", [r[0] for r in roles_after] or "none")
        print("done")


if __name__ == "__main__":
    main()
