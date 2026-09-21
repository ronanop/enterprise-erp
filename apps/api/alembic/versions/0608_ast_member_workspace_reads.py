"""Grant Asset roles org/master workspace reads used by Configuration + import.

Recovered stub for a revision that was applied to shared RDS from an unpushed
working copy (down_revision 0607). Re-syncs role permissions so the
ASSET_MEMBER_WORKSPACE_READ_PERMISSIONS codes are present — idempotent inserts.
"""

from collections.abc import Sequence
from datetime import datetime, timezone
from uuid import uuid4

import sqlalchemy as sa
from alembic import op

from modules.asset.permissions import (
    ASSET_ADMIN_PERMISSIONS,
    ASSET_AUDITOR_PERMISSIONS,
    ASSET_EXECUTIVE_PERMISSIONS,
    ASSET_MANAGER_PERMISSIONS,
)

revision: str = "0608_ast_member_workspace_reads"
down_revision: str | None = "0607_merge_ast_org_heads"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None

ROLE_SPECS: list[tuple[str, list[str]]] = [
    ("ASSET_MANAGER", ASSET_MANAGER_PERMISSIONS),
    ("ASSET_EXECUTIVE", ASSET_EXECUTIVE_PERMISSIONS),
    ("ASSET_AUDITOR", ASSET_AUDITOR_PERMISSIONS),
    ("ASSET_ADMIN", ASSET_ADMIN_PERMISSIONS),
]


def upgrade() -> None:
    conn = op.get_bind()
    now = datetime.now(timezone.utc)

    perm_ids: dict[str, str] = {}
    for code in sorted({c for _, codes in ROLE_SPECS for c in codes}):
        row = conn.execute(
            sa.text("SELECT id FROM foundation.sec_permission WHERE permission_code = :code"),
            {"code": code},
        ).first()
        if row:
            perm_ids[code] = str(row[0])

    tenants = conn.execute(
        sa.text("SELECT id FROM foundation.sec_tenant WHERE is_deleted = false")
    ).fetchall()
    for (tenant_id,) in tenants:
        tid = str(tenant_id)
        for role_code, codes in ROLE_SPECS:
            role = conn.execute(
                sa.text(
                    """
                    SELECT id FROM foundation.sec_role
                    WHERE tenant_id = :tid AND role_code = :code AND is_deleted = false
                    """
                ),
                {"tid": tid, "code": role_code},
            ).first()
            if not role:
                continue
            role_id = str(role[0])
            for code in codes:
                pid = perm_ids.get(code)
                if not pid:
                    continue
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
