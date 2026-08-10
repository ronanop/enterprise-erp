"""Grant approve_media to marketing demo team roles."""

import sys
from collections.abc import Sequence
from datetime import datetime, timezone
from pathlib import Path
from uuid import uuid4

import sqlalchemy as sa
from alembic import op

revision: str = "0483_mkt_demo_media_perm"
down_revision: str | None = "0482_mkt_approve_media_perm"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None

DEMO_ROLES = (
    "MARKETING_HEAD_DEMO",
    "MARKETING_MEDIA_HANDLER",
    "MARKETING_BANNER_HANDLER",
)


def _grant(conn, now, tenant_id, role_id, perm_id):
    exists = conn.execute(
        sa.text(
            "SELECT 1 FROM foundation.sec_role_permission WHERE role_id = :rid AND permission_id = :pid"
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
    perm = conn.execute(
        sa.text("SELECT id FROM foundation.sec_permission WHERE permission_code = 'marketing.content:approve_media'")
    ).first()
    if not perm:
        return
    perm_id = str(perm[0])
    tenants = conn.execute(sa.text("SELECT id FROM foundation.sec_tenant WHERE is_deleted = false")).fetchall()
    for (tenant_id,) in tenants:
        tid = str(tenant_id)
        for role_code in DEMO_ROLES:
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
            if role:
                _grant(conn, now, tid, str(role[0]), perm_id)


def downgrade() -> None:
    pass
