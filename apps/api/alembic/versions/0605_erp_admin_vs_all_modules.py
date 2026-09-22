"""ERP admins (techbank + connectplus) vs assignable All-modules.

- Elevate only platform emails to super_admin + SUPER_ADMIN.
- Demote every other account (including HRMS Superadmin) from ERP admin.
- Preserve HRMS Superadmin HR access via HR_ADMIN + HR_SUPERADMIN role.
"""

from collections.abc import Sequence
from uuid import uuid4

import sqlalchemy as sa
from alembic import op

revision: str = "0605_erp_admin_vs_all_modules"
down_revision: str | None = "0604_crm_lead_committed_presales"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None

PLATFORM_ADMIN_EMAILS = (
    "techbank@cachedigitech.com",
    "connectplus@cachedigitech.com",
)
HRMS_SUPERADMIN_EMAIL = "hr@cachedigitech.com"
ADMIN_ROLE_CODES = ("SUPER_ADMIN", "TENANT_ADMIN")
HR_SUPERADMIN_ROLE = "HR_SUPERADMIN"
HR_SUPERADMIN_PERM = "hr.superadmin:manage"


def upgrade() -> None:
    conn = op.get_bind()
    emails = list(PLATFORM_ADMIN_EMAILS)

    # Elevate platform ERP admins.
    conn.execute(
        sa.text(
            """
            UPDATE foundation.sec_user
            SET user_type = 'super_admin',
                updated_at = NOW()
            WHERE lower(email) = ANY(:emails)
              AND is_deleted = false
            """
        ),
        {"emails": emails},
    )

    # Demote everyone else from ERP admin user_type.
    conn.execute(
        sa.text(
            """
            UPDATE foundation.sec_user
            SET user_type = 'employee',
                updated_at = NOW()
            WHERE lower(email) <> ALL(:emails)
              AND is_deleted = false
              AND user_type IN ('super_admin', 'tenant_admin')
            """
        ),
        {"emails": emails},
    )

    # Strip platform admin roles from non-platform users.
    conn.execute(
        sa.text(
            """
            DELETE FROM foundation.sec_user_role ur
            USING foundation.sec_role r, foundation.sec_user u
            WHERE ur.role_id = r.id
              AND ur.user_id = u.id
              AND upper(r.role_code) = ANY(:codes)
              AND lower(u.email) <> ALL(:emails)
              AND u.is_deleted = false
            """
        ),
        {"emails": emails, "codes": list(ADMIN_ROLE_CODES)},
    )

    # Ensure platform admins have SUPER_ADMIN role.
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
            WHERE lower(u.email) = ANY(:emails)
              AND u.is_deleted = false
              AND NOT EXISTS (
                SELECT 1
                FROM foundation.sec_user_role ur
                WHERE ur.user_id = u.id AND ur.role_id = r.id
              )
            """
        ),
        {"emails": emails},
    )

    # HRMS Superadmin: keep HR module admin + dedicated HR_SUPERADMIN role.
    hr_user = conn.execute(
        sa.text(
            """
            SELECT id, tenant_id
            FROM foundation.sec_user
            WHERE lower(email) = lower(:email)
              AND is_deleted = false
            LIMIT 1
            """
        ),
        {"email": HRMS_SUPERADMIN_EMAIL},
    ).first()
    if hr_user is not None:
        hr_user_id, tenant_id = hr_user[0], hr_user[1]
        # Ensure hr module admin row.
        exists = conn.execute(
            sa.text(
                """
                SELECT 1 FROM foundation.sec_user_module
                WHERE user_id = :uid AND module_key = 'hr'
                """
            ),
            {"uid": hr_user_id},
        ).first()
        if exists is None:
            conn.execute(
                sa.text(
                    """
                    INSERT INTO foundation.sec_user_module
                      (id, tenant_id, user_id, module_key, role, assigned_at, assigned_by)
                    VALUES (:id, :tid, :uid, 'hr', 'admin', NOW(), NULL)
                    """
                ),
                {"id": str(uuid4()), "tid": tenant_id, "uid": hr_user_id},
            )
        else:
            conn.execute(
                sa.text(
                    """
                    UPDATE foundation.sec_user_module
                    SET role = 'admin', assigned_at = NOW()
                    WHERE user_id = :uid AND module_key = 'hr'
                    """
                ),
                {"uid": hr_user_id},
            )

        # Ensure HR_ADMIN role remains.
        conn.execute(
            sa.text(
                """
                INSERT INTO foundation.sec_user_role (id, tenant_id, user_id, role_id, assigned_at, assigned_by)
                SELECT gen_random_uuid(), :tid, :uid, r.id, NOW(), NULL
                FROM foundation.sec_role r
                WHERE r.tenant_id = :tid
                  AND r.role_code = 'HR_ADMIN'
                  AND r.is_deleted = false
                  AND NOT EXISTS (
                    SELECT 1 FROM foundation.sec_user_role ur
                    WHERE ur.user_id = :uid AND ur.role_id = r.id
                  )
                """
            ),
            {"tid": tenant_id, "uid": hr_user_id},
        )

        # Create HR_SUPERADMIN role (hr.superadmin:manage only) if missing.
        role_row = conn.execute(
            sa.text(
                """
                SELECT id FROM foundation.sec_role
                WHERE tenant_id = :tid
                  AND role_code = :code
                  AND is_deleted = false
                LIMIT 1
                """
            ),
            {"tid": tenant_id, "code": HR_SUPERADMIN_ROLE},
        ).first()
        if role_row is None:
            role_id = str(uuid4())
            conn.execute(
                sa.text(
                    """
                    INSERT INTO foundation.sec_role
                      (id, tenant_id, role_code, role_name, description,
                       is_system_role, status, is_deleted, version, created_at, updated_at)
                    VALUES
                      (:id, :tid, :code, 'HR Superadmin', 'HRMS Superadmin Panel only',
                       true, 'active', false, 1, NOW(), NOW())
                    """
                ),
                {"id": role_id, "tid": tenant_id, "code": HR_SUPERADMIN_ROLE},
            )
        else:
            role_id = str(role_row[0])

        perm = conn.execute(
            sa.text(
                """
                SELECT id FROM foundation.sec_permission
                WHERE permission_code = :code
                LIMIT 1
                """
            ),
            {"code": HR_SUPERADMIN_PERM},
        ).first()
        if perm is not None:
            conn.execute(
                sa.text(
                    """
                    INSERT INTO foundation.sec_role_permission
                      (id, tenant_id, role_id, permission_id, granted_at)
                    SELECT gen_random_uuid(), :tid, :rid, :pid, NOW()
                    WHERE NOT EXISTS (
                      SELECT 1 FROM foundation.sec_role_permission
                      WHERE role_id = :rid AND permission_id = :pid
                    )
                    """
                ),
                {"tid": tenant_id, "rid": role_id, "pid": str(perm[0])},
            )

        conn.execute(
            sa.text(
                """
                INSERT INTO foundation.sec_user_role (id, tenant_id, user_id, role_id, assigned_at, assigned_by)
                SELECT gen_random_uuid(), :tid, :uid, :rid, NOW(), NULL
                WHERE NOT EXISTS (
                  SELECT 1 FROM foundation.sec_user_role
                  WHERE user_id = :uid AND role_id = :rid
                )
                """
            ),
            {"tid": tenant_id, "uid": hr_user_id, "rid": role_id},
        )

    # Force re-login for demoted non-platform former admins.
    conn.execute(
        sa.text(
            """
            UPDATE foundation.sec_session s
            SET revoked_at = NOW()
            FROM foundation.sec_user u
            WHERE s.user_id = u.id
              AND lower(u.email) <> ALL(:emails)
              AND u.is_deleted = false
              AND s.revoked_at IS NULL
            """
        ),
        {"emails": emails},
    )


def downgrade() -> None:
    # Data migration - no automatic rollback.
    pass
