"""Create ast_dc_challan + DC challan permissions."""

import sys
from collections.abc import Sequence
from datetime import datetime, timezone
from pathlib import Path
from uuid import uuid4

import sqlalchemy as sa
from alembic import op

sys.path.insert(0, str(Path(__file__).resolve().parents[2] / "src"))

from modules.asset.models.dc_challan import AstDcChallan  # noqa: E402, F401
from modules.asset.permissions import (  # noqa: E402
    ASSET_ADMIN_PERMISSIONS,
    ASSET_AUDITOR_PERMISSIONS,
    ASSET_EXECUTIVE_PERMISSIONS,
    ASSET_MANAGER_PERMISSIONS,
)

revision: str = "0497_ast_dc_challan"
down_revision: str | None = "0496_revert_org_location_head_office"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None

PERMISSION_TABLE = sa.table(
    "sec_permission",
    sa.column("id", sa.Uuid),
    sa.column("permission_code", sa.String),
    sa.column("resource", sa.String),
    sa.column("action", sa.String),
    sa.column("module", sa.String),
    sa.column("is_active", sa.Boolean),
    sa.column("created_at", sa.DateTime(timezone=True)),
    schema="foundation",
)

ROLE_SPECS: list[tuple[str, list[str]]] = [
    ("ASSET_MANAGER", ASSET_MANAGER_PERMISSIONS),
    ("ASSET_EXECUTIVE", ASSET_EXECUTIVE_PERMISSIONS),
    ("ASSET_AUDITOR", ASSET_AUDITOR_PERMISSIONS),
    ("ASSET_ADMIN", ASSET_ADMIN_PERMISSIONS),
]

NEW_PERMISSIONS = [
    ("asset.dc_challan:read", "asset.dc_challan", "read", "asset"),
    ("asset.dc_challan:create", "asset.dc_challan", "create", "asset"),
    ("asset.dc_challan:update", "asset.dc_challan", "update", "asset"),
    ("asset.dc_challan:send", "asset.dc_challan", "send", "asset"),
    ("asset.dc_challan:receive", "asset.dc_challan", "receive", "asset"),
]


def _ensure_permission(conn, now, code, resource, action, module):
    exists = conn.execute(
        sa.text("SELECT id FROM foundation.sec_permission WHERE permission_code = :code"),
        {"code": code},
    ).first()
    if exists:
        return str(exists[0])
    perm_id = str(uuid4())
    conn.execute(
        sa.insert(PERMISSION_TABLE).values(
            id=perm_id,
            permission_code=code,
            resource=resource,
            action=action,
            module=module,
            is_active=True,
            created_at=now,
        )
    )
    return perm_id


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
    bind = op.get_bind()
    AstDcChallan.__table__.create(bind=bind, checkfirst=True)

    conn = bind
    now = datetime.now(timezone.utc)
    perm_ids = {
        code: _ensure_permission(conn, now, code, resource, action, module)
        for code, resource, action, module in NEW_PERMISSIONS
    }

    roles = conn.execute(
        sa.text(
            """
            SELECT id, tenant_id, role_code FROM foundation.sec_role
            WHERE role_code IN (
                'ASSET_MANAGER','ASSET_EXECUTIVE','ASSET_AUDITOR','ASSET_ADMIN',
                'SUPER_ADMIN','TENANT_ADMIN'
            )
              AND is_deleted IS FALSE
            """
        )
    ).all()
    role_perm_map = {code: perms for code, perms in ROLE_SPECS}
    admin_all = list(perm_ids.keys())
    for role_id, tenant_id, role_code in roles:
        codes = (
            admin_all
            if role_code in {"SUPER_ADMIN", "TENANT_ADMIN"}
            else role_perm_map.get(role_code, [])
        )
        for code in codes:
            if code in perm_ids:
                _grant(conn, now, str(tenant_id), str(role_id), perm_ids[code])


def downgrade() -> None:
    bind = op.get_bind()
    AstDcChallan.__table__.drop(bind=bind, checkfirst=True)

    conn = bind
    for code, _, _, _ in reversed(NEW_PERMISSIONS):
        conn.execute(
            sa.text(
                """
                DELETE FROM foundation.sec_role_permission
                WHERE permission_id IN (
                    SELECT id FROM foundation.sec_permission WHERE permission_code = :code
                )
                """
            ),
            {"code": code},
        )
        conn.execute(
            sa.text("DELETE FROM foundation.sec_permission WHERE permission_code = :code"),
            {"code": code},
        )
