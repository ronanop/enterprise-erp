"""Add marketing.content:approve_media permission."""

import sys
from collections.abc import Sequence
from datetime import datetime, timezone
from pathlib import Path
from uuid import uuid4

import sqlalchemy as sa
from alembic import op

sys.path.insert(0, str(Path(__file__).resolve().parents[2] / "src"))

from modules.marketing.permissions import MARKETING_PERMISSIONS

revision: str = "0482_mkt_approve_media_perm"
down_revision: str | None = "0481_mkt_admin_perms"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None

NEW_PERM = ("marketing.content:approve_media", "marketing.content", "approve_media", "marketing")


def _ensure_permission(conn, now, code, resource, action, module):
    exists = conn.execute(
        sa.text("SELECT id FROM foundation.sec_permission WHERE permission_code = :code"),
        {"code": code},
    ).first()
    if exists:
        return str(exists[0])
    perm_id = str(uuid4())
    conn.execute(
        sa.text(
            """
            INSERT INTO foundation.sec_permission
            (id, permission_code, resource, action, module, is_active, created_at)
            VALUES (:id, :code, :resource, :action, :module, true, :now)
            """
        ),
        {"id": perm_id, "code": code, "resource": resource, "action": action, "module": module, "now": now},
    )
    return perm_id


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
    code, resource, action, module = NEW_PERM
    perm_id = _ensure_permission(conn, now, code, resource, action, module)

    grant_roles = (
        "MARKETING_ADMIN",
        "MARKETING_MANAGER",
        "MARKETING_MEDIA_HANDLER",
        "MARKETING_BANNER_HANDLER",
        "SUPER_ADMIN",
        "TENANT_ADMIN",
    )
    tenants = conn.execute(sa.text("SELECT id FROM foundation.sec_tenant WHERE is_deleted = false")).fetchall()
    for (tenant_id,) in tenants:
        tid = str(tenant_id)
        for role_code in grant_roles:
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
    conn = op.get_bind()
    conn.execute(
        sa.text(
            "DELETE FROM foundation.sec_role_permission WHERE permission_id IN "
            "(SELECT id FROM foundation.sec_permission WHERE permission_code = 'marketing.content:approve_media')"
        )
    )
    conn.execute(
        sa.text("DELETE FROM foundation.sec_permission WHERE permission_code = 'marketing.content:approve_media'")
    )
