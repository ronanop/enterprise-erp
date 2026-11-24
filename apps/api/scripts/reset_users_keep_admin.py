"""Reset ERP logins to only admin@example.com (Platform Admin).

Soft-deletes every other foundation.sec_user, clears sessions/module grants,
and frees master employees so HRMS API sync can recreate them.

Usage (from apps/api):
  python -m scripts.reset_users_keep_admin
"""

from __future__ import annotations

import sys
from pathlib import Path

from sqlalchemy import text

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT))
sys.path.insert(0, str(ROOT / "src"))

from database.session import SessionLocal  # noqa: E402

KEEP_EMAIL = "admin@example.com"


def main() -> None:
    db = SessionLocal()
    try:
        keep = db.execute(
            text(
                """
                SELECT id::text
                FROM foundation.sec_user
                WHERE lower(email) = lower(:email)
                  AND user_type = 'super_admin'
                  AND is_deleted = false
                ORDER BY created_at ASC
                LIMIT 1
                """
            ),
            {"email": KEEP_EMAIL},
        ).first()
        if keep is None:
            raise RuntimeError(
                f"{KEEP_EMAIL} (super_admin) not found. Run: python -m scripts.seed_admin_login"
            )
        keep_id = keep[0]

        removed = db.execute(
            text(
                """
                SELECT id::text
                FROM foundation.sec_user
                WHERE id::text <> :keep_id
                  AND is_deleted = false
                """
            ),
            {"keep_id": keep_id},
        ).fetchall()
        removed_ids = [r[0] for r in removed]

        # Soft-delete + free emails for every other active login.
        db.execute(
            text(
                """
                UPDATE foundation.sec_user
                SET is_deleted = true,
                    status = 'inactive',
                    email = left('deleted-' || replace(id::text, '-', '') || '-' || email, 255),
                    updated_at = NOW(),
                    version = COALESCE(version, 1) + 1
                WHERE id::text <> :keep_id
                  AND is_deleted = false
                """
            ),
            {"keep_id": keep_id},
        )

        # Soft-delete / rename any leftover rows still using the keep email.
        db.execute(
            text(
                """
                UPDATE foundation.sec_user
                SET is_deleted = true,
                    status = 'inactive',
                    email = left('deleted-' || replace(id::text, '-', '') || '-' || email, 255),
                    updated_at = NOW(),
                    version = COALESCE(version, 1) + 1
                WHERE lower(email) = lower(:email)
                  AND id::text <> :keep_id
                """
            ),
            {"email": KEEP_EMAIL, "keep_id": keep_id},
        )

        if removed_ids:
            params = {"ids": removed_ids}
            db.execute(
                text("DELETE FROM foundation.sec_refresh_token WHERE user_id::text = ANY(:ids)"),
                params,
            )
            db.execute(
                text("DELETE FROM foundation.sec_session WHERE user_id::text = ANY(:ids)"),
                params,
            )
            db.execute(
                text("DELETE FROM foundation.sec_user_module WHERE user_id::text = ANY(:ids)"),
                params,
            )
            db.execute(
                text("DELETE FROM foundation.sec_user_role WHERE user_id::text = ANY(:ids)"),
                params,
            )
            db.execute(
                text("DELETE FROM foundation.sec_user_org_scope WHERE user_id::text = ANY(:ids)"),
                params,
            )
            db.execute(
                text(
                    """
                    UPDATE master.master_employee
                    SET user_id = NULL,
                        updated_at = NOW(),
                        version = COALESCE(version, 1) + 1
                    WHERE user_id::text = ANY(:ids)
                    """
                ),
                params,
            )

        # Soft-delete live employees, then free unique keys on ALL deleted rows
        # (including older soft-deletes) so API import is not blocked.
        live = db.execute(
            text(
                """
                UPDATE master.master_employee
                SET is_deleted = true,
                    deleted_at = NOW(),
                    user_id = NULL,
                    status = 'ex_employee',
                    updated_at = NOW(),
                    version = COALESCE(version, 1) + 1
                WHERE is_deleted = false
                """
            )
        )
        freed_employees = live.rowcount or 0
        db.execute(
            text(
                """
                UPDATE master.master_employee
                SET employee_code = CASE
                      WHEN employee_code LIKE '%-DEL-%' THEN employee_code
                      ELSE left(employee_code || '-DEL-' || substr(replace(id::text, '-', ''), 1, 8), 50)
                    END,
                    email = left('deleted-' || replace(id::text, '-', '') || '@cleared.local', 255),
                    email_lookup = left('del-' || replace(id::text, '-', ''), 64),
                    mobile = '0000000000',
                    mobile_lookup = left('delm-' || replace(id::text, '-', ''), 64),
                    updated_at = NOW()
                WHERE is_deleted = true
                  AND (
                    email_lookup NOT LIKE 'del-%'
                    OR mobile_lookup NOT LIKE 'delm-%'
                    OR employee_code NOT LIKE '%-DEL-%'
                  )
                """
            )
        )

        db.execute(
            text(
                """
                UPDATE foundation.sec_user
                SET is_deleted = false,
                    status = 'active',
                    user_type = 'super_admin',
                    display_name = 'Platform Admin',
                    failed_login_count = 0,
                    locked_until = NULL,
                    must_change_password = false,
                    updated_at = NOW()
                WHERE id::text = :keep_id
                """
            ),
            {"keep_id": keep_id},
        )

        db.commit()

        active = db.execute(
            text(
                """
                SELECT email, user_type, status
                FROM foundation.sec_user
                WHERE is_deleted = false
                ORDER BY email
                """
            )
        ).fetchall()

        print("=" * 60)
        print("Users reset")
        print("=" * 60)
        print(f"Kept        : {KEEP_EMAIL} ({keep_id})")
        print(f"Removed     : {len(removed_ids)} logins soft-deleted")
        print(f"Employees   : {freed_employees} master rows freed for API re-import")
        print(f"Active now  : {len(active)}")
        for row in active:
            print(f"  - {row[0]}  {row[1]}  {row[2]}")
        print("Next: /organization/users/hrms-api → Fetch & sync employees")
        print("=" * 60)
    except Exception:
        db.rollback()
        raise
    finally:
        db.close()


if __name__ == "__main__":
    main()
