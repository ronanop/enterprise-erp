"""Grant all asset module permissions to SUPER_ADMIN and TENANT_ADMIN.

Governance migrations (0466–0485) seeded granular asset permissions on ASSET_* roles
only. Demo and platform admins use SUPER_ADMIN / TENANT_ADMIN and need the same grants.
"""

import sys
from collections.abc import Sequence
from datetime import datetime, timezone
from pathlib import Path
from uuid import uuid4

import sqlalchemy as sa
from alembic import op

sys.path.insert(0, str(Path(__file__).resolve().parents[2] / "src"))

from modules.asset.permissions import ASSET_PERMISSIONS  # noqa: E402

revision: str = "0486_ast_tenant_admin_asset_permissions"
down_revision: str | None = "0485_ast_discovery_profile"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None

ADMIN_ROLE_CODES = ("SUPER_ADMIN", "TENANT_ADMIN")


def _grant(conn, now: datetime, tenant_id: str, role_id: str, perm_id: str) -> None:
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

    perm_ids: list[str] = []
    for code, _, _, _ in ASSET_PERMISSIONS:
        row = conn.execute(
            sa.text(
                "SELECT id FROM foundation.sec_permission WHERE permission_code = :code"
            ),
            {"code": code},
        ).first()
        if row:
            perm_ids.append(str(row[0]))

    tenants = conn.execute(
        sa.text("SELECT id FROM foundation.sec_tenant WHERE is_deleted = false")
    ).fetchall()

    for (tenant_id,) in tenants:
        tid = str(tenant_id)
        for role_code in ADMIN_ROLE_CODES:
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
    pass
