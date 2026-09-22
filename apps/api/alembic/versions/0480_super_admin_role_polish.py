"""Ensure SUPER_ADMIN / TENANT_ADMIN display names and grant-all permissions."""

from collections.abc import Sequence
from datetime import datetime, timezone
from uuid import uuid4

import sqlalchemy as sa
from alembic import op

revision: str = "0480_super_admin_role_polish"
down_revision: str | None = "0479_hr_role_packs_resync"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None

ROLE_SPECS = (
    ("SUPER_ADMIN", "Super Admin"),
    ("TENANT_ADMIN", "Tenant Admin"),
)


def upgrade() -> None:
    conn = op.get_bind()
    now = datetime.now(timezone.utc)

    perms = conn.execute(
        sa.text("SELECT id FROM foundation.sec_permission WHERE is_active = true")
    ).fetchall()
    perm_ids = [str(r[0]) for r in perms]

    tenants = conn.execute(
        sa.text("SELECT id FROM foundation.sec_tenant WHERE is_deleted = false")
    ).fetchall()

    for (tenant_id,) in tenants:
        tid = str(tenant_id)
        for role_code, role_name in ROLE_SPECS:
            role = conn.execute(
                sa.text(
                    """
                    SELECT id FROM foundation.sec_role
                    WHERE tenant_id = :tid AND role_code = :code AND is_deleted = false
                    """
                ),
                {"tid": tid, "code": role_code},
            ).first()
            if role:
                role_id = str(role[0])
                conn.execute(
                    sa.text(
                        """
                        UPDATE foundation.sec_role
                        SET role_name = :name, updated_at = :now, is_system_role = true
                        WHERE id = :id
                        """
                    ),
                    {"name": role_name, "now": now, "id": role_id},
                )
            else:
                role_id = str(uuid4())
                conn.execute(
                    sa.text(
                        """
                        INSERT INTO foundation.sec_role
                        (id, tenant_id, role_code, role_name, is_system_role, status,
                         created_at, updated_at, is_deleted, version)
                        VALUES (:id, :tid, :code, :name, true, 'active', :now, :now, false, 1)
                        """
                    ),
                    {
                        "id": role_id,
                        "tid": tid,
                        "code": role_code,
                        "name": role_name,
                        "now": now,
                    },
                )

            for pid in perm_ids:
                exists = conn.execute(
                    sa.text(
                        """
                        SELECT 1 FROM foundation.sec_role_permission
                        WHERE role_id = :rid AND permission_id = :pid
                        """
                    ),
                    {"rid": role_id, "pid": pid},
                ).first()
                if exists:
                    continue
                conn.execute(
                    sa.text(
                        """
                        INSERT INTO foundation.sec_role_permission
                        (id, tenant_id, role_id, permission_id, granted_at)
                        VALUES (:id, :tid, :rid, :pid, :now)
                        """
                    ),
                    {
                        "id": str(uuid4()),
                        "tid": tid,
                        "rid": role_id,
                        "pid": pid,
                        "now": now,
                    },
                )


def downgrade() -> None:
    pass
