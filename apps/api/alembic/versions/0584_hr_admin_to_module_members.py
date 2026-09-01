"""Convert legacy Superadmin HR_ADMIN assignments to HR module members."""

from collections.abc import Sequence

import sqlalchemy as sa
from alembic import op

revision: str = "0584_hr_admin_to_module_members"
down_revision: str | None = "0583_sync_org_module_admin_roles"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    conn = op.get_bind()
    conn.execute(
        sa.text(
            """
            INSERT INTO foundation.sec_user_module (
              id, tenant_id, user_id, module_key, role, assigned_at, assigned_by
            )
            SELECT
              gen_random_uuid(),
              u.tenant_id,
              u.id,
              'hr',
              'member',
              NOW(),
              NULL
            FROM foundation.sec_user u
            JOIN foundation.sec_user_role ur ON ur.user_id = u.id
            JOIN foundation.sec_role r ON r.id = ur.role_id AND r.role_code = 'HR_ADMIN'
            WHERE u.is_deleted = false
              AND NOT EXISTS (
                SELECT 1 FROM foundation.sec_user_module um
                WHERE um.user_id = u.id AND um.module_key = 'hr'
              )
              AND NOT EXISTS (
                SELECT 1 FROM foundation.sec_user_module um
                WHERE um.user_id = u.id AND um.module_key = 'hr' AND um.role = 'admin'
              )
            """
        )
    )
    conn.execute(
        sa.text(
            """
            INSERT INTO foundation.sec_user_role (id, tenant_id, user_id, role_id, assigned_at, assigned_by)
            SELECT gen_random_uuid(), u.tenant_id, u.id, er.id, NOW(), NULL
            FROM foundation.sec_user u
            JOIN foundation.sec_user_role ur ON ur.user_id = u.id
            JOIN foundation.sec_role hr ON hr.id = ur.role_id AND hr.role_code = 'HR_ADMIN'
            JOIN foundation.sec_role er ON er.tenant_id = u.tenant_id
              AND er.role_code = 'HR_EMPLOYEE' AND er.is_deleted = false
            WHERE u.is_deleted = false
              AND NOT EXISTS (
                SELECT 1 FROM foundation.sec_user_module um
                WHERE um.user_id = u.id AND um.module_key = 'hr' AND um.role = 'admin'
              )
              AND NOT EXISTS (
                SELECT 1 FROM foundation.sec_user_role ur2
                WHERE ur2.user_id = u.id AND ur2.role_id = er.id
              )
            """
        )
    )
    conn.execute(
        sa.text(
            """
            DELETE FROM foundation.sec_user_role ur
            USING foundation.sec_user u, foundation.sec_role hr
            WHERE ur.user_id = u.id
              AND ur.role_id = hr.id
              AND hr.role_code = 'HR_ADMIN'
              AND u.is_deleted = false
              AND NOT EXISTS (
                SELECT 1 FROM foundation.sec_user_module um
                WHERE um.user_id = u.id AND um.module_key = 'hr' AND um.role = 'admin'
              )
            """
        )
    )


def downgrade() -> None:
    pass
