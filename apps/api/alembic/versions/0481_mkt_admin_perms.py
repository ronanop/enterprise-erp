"""Grant marketing permissions to SUPER_ADMIN and TENANT_ADMIN."""

from collections.abc import Sequence
from datetime import datetime, timezone
from uuid import uuid4

import sqlalchemy as sa
from alembic import op

revision: str = "0481_mkt_admin_perms"
down_revision: str | None = "0480_seed_marketing_permissions"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def _grant(conn, now, tenant_id, role_id, perm_id):
    exists = conn.execute(
        sa.text(
            """
            SELECT 1 FROM foundation.sec_role_permission
            WHERE role_id = :rid AND permission_id = :pid
            """
        ),
        {"rid": role_id, "pid": perm_id},
    ).first()
    if exists:
        return
    conn.execute(
        sa.text(
            """
            INSERT INTO foundation.sec_role_permission
            (id, tenant_id, role_id, permission_id, granted_at)
            VALUES (:id, :tid, :rid, :pid, :now)
            """
        ),
        {"id": str(uuid4()), "tid": tenant_id, "rid": role_id, "pid": perm_id, "now": now},
    )


def upgrade() -> None:
    conn = op.get_bind()
    now = datetime.now(timezone.utc)
    perm_rows = conn.execute(
        sa.text("SELECT id FROM foundation.sec_permission WHERE module = 'marketing' AND is_active = true")
    ).fetchall()
    perm_ids = [str(row[0]) for row in perm_rows]
    if not perm_ids:
        return

    tenants = conn.execute(sa.text("SELECT id FROM foundation.sec_tenant WHERE is_deleted = false")).fetchall()
    for (tenant_id,) in tenants:
        tid = str(tenant_id)
        for role_code in ("SUPER_ADMIN", "TENANT_ADMIN"):
            role = conn.execute(
                sa.text(
                    """
                    SELECT id FROM foundation.sec_role
                    WHERE tenant_id = :tid AND role_code = :code AND is_deleted = false
                    LIMIT 1
                    """
                ),
                {"tid": tid, "code": role_code},
            ).first()
            if not role:
                continue
            role_id = str(role[0])
            for perm_id in perm_ids:
                _grant(conn, now, tid, role_id, perm_id)


def downgrade() -> None:
    conn = op.get_bind()
    conn.execute(
        sa.text(
            """
            DELETE FROM foundation.sec_role_permission
            WHERE permission_id IN (
                SELECT id FROM foundation.sec_permission WHERE module = 'marketing'
            )
            AND role_id IN (
                SELECT id FROM foundation.sec_role
                WHERE role_code IN ('SUPER_ADMIN', 'TENANT_ADMIN')
            )
            """
        )
    )
