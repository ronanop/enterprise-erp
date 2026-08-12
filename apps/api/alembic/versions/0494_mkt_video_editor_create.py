"""Grant video editor content create/submit permissions for section workflow."""

from __future__ import annotations

import sys
from collections.abc import Sequence
from datetime import datetime, timezone
from pathlib import Path
from uuid import uuid4

import sqlalchemy as sa
from alembic import op

sys.path.insert(0, str(Path(__file__).resolve().parents[2] / "src"))

from modules.marketing.permissions import MARKETING_VIDEO_EDITOR_PERMISSIONS  # noqa: E402

revision: str = "0494_mkt_video_editor_create"
down_revision: str | None = "0493_mkt_video_section"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None

ROLE_CODE = "MARKETING_VIDEO_EDITOR"


def _grant(conn, now, tenant_id: str, role_id: str, perm_id: str) -> None:
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
    perm_rows = conn.execute(
        sa.text(
            """
            SELECT permission_code, id
            FROM foundation.sec_permission
            WHERE permission_code = ANY(:codes) AND is_active = true
            """
        ),
        {"codes": list(MARKETING_VIDEO_EDITOR_PERMISSIONS)},
    ).fetchall()
    perm_map = {str(code): str(pid) for code, pid in perm_rows}

    tenants = conn.execute(
        sa.text("SELECT id FROM foundation.sec_tenant WHERE is_deleted = false")
    ).fetchall()
    for (tenant_id,) in tenants:
        tid = str(tenant_id)
        role = conn.execute(
            sa.text(
                """
                SELECT id FROM foundation.sec_role
                WHERE tenant_id = :tid AND role_code = :code AND is_deleted = false
                LIMIT 1
                """
            ),
            {"tid": tid, "code": ROLE_CODE},
        ).first()
        if not role:
            continue
        role_id = str(role[0])
        for code in MARKETING_VIDEO_EDITOR_PERMISSIONS:
            perm_id = perm_map.get(code)
            if perm_id:
                _grant(conn, now, tid, role_id, perm_id)


def downgrade() -> None:
    pass
