"""Demote non-platform-admin users and clear module assignments.

Only techbank@cachedigitech.com remains ERP admin (super_admin + SUPER_ADMIN).
All other active users become employees with no admin roles or module rows.
"""

from collections.abc import Sequence

import sqlalchemy as sa
from alembic import op

revision: str = "0582_reset_platform_admin_access"
down_revision: str | None = "0581_ast_schema_repair_stamped_gaps"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None

PLATFORM_ADMIN_EMAIL = "techbank@cachedigitech.com"
ADMIN_ROLE_CODES = ("SUPER_ADMIN", "TENANT_ADMIN")


def upgrade() -> None:
    conn = op.get_bind()

    # Ensure platform admin is elevated.
    conn.execute(
        sa.text(
            """
            UPDATE foundation.sec_user
            SET user_type = 'super_admin',
                updated_at = NOW()
            WHERE lower(email) = lower(:email)
              AND is_deleted = false
            """
        ),
        {"email": PLATFORM_ADMIN_EMAIL},
    )

    # Demote everyone else.
    conn.execute(
        sa.text(
            """
            UPDATE foundation.sec_user
            SET user_type = 'employee',
                updated_at = NOW()
            WHERE lower(email) != lower(:email)
              AND is_deleted = false
            """
        ),
        {"email": PLATFORM_ADMIN_EMAIL},
    )

    # Remove admin role links from non-platform users.
    conn.execute(
        sa.text(
            """
            DELETE FROM foundation.sec_user_role ur
            USING foundation.sec_role r, foundation.sec_user u
            WHERE ur.role_id = r.id
              AND ur.user_id = u.id
              AND upper(r.role_code) = ANY(:codes)
              AND lower(u.email) != lower(:email)
              AND u.is_deleted = false
            """
        ),
        {"email": PLATFORM_ADMIN_EMAIL, "codes": list(ADMIN_ROLE_CODES)},
    )

    # Clear module assignments for non-platform users.
    conn.execute(
        sa.text(
            """
            DELETE FROM foundation.sec_user_module um
            USING foundation.sec_user u
            WHERE um.user_id = u.id
              AND lower(u.email) != lower(:email)
              AND u.is_deleted = false
            """
        ),
        {"email": PLATFORM_ADMIN_EMAIL},
    )

    # Ensure platform admin has SUPER_ADMIN role when tenant/role exist.
    conn.execute(
        sa.text(
            """
            INSERT INTO foundation.sec_user_role (id, tenant_id, user_id, role_id, assigned_at, assigned_by)
            SELECT gen_random_uuid(), u.tenant_id, u.id, r.id, NOW(), NULL
            FROM foundation.sec_user u
            JOIN foundation.sec_role r
              ON r.tenant_id = u.tenant_id
             AND r.role_code = 'SUPER_ADMIN'
             AND r.is_deleted = false
            WHERE lower(u.email) = lower(:email)
              AND u.is_deleted = false
              AND NOT EXISTS (
                SELECT 1
                FROM foundation.sec_user_role ur
                WHERE ur.user_id = u.id AND ur.role_id = r.id
              )
            """
        ),
        {"email": PLATFORM_ADMIN_EMAIL},
    )

    # Force re-login for demoted users so JWT/session user_type refreshes.
    conn.execute(
        sa.text(
            """
            UPDATE foundation.sec_session s
            SET revoked_at = NOW()
            FROM foundation.sec_user u
            WHERE s.user_id = u.id
              AND lower(u.email) != lower(:email)
              AND u.is_deleted = false
              AND s.revoked_at IS NULL
            """
        ),
        {"email": PLATFORM_ADMIN_EMAIL},
    )


def downgrade() -> None:
    # Data migration — no automatic rollback.
    pass
