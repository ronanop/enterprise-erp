"""FP-ASSET-009: warranty action permissions, open index, status constraint expand."""

import sys
from collections.abc import Sequence
from datetime import datetime, timezone
from pathlib import Path
from uuid import uuid4

import sqlalchemy as sa
from alembic import op

sys.path.insert(0, str(Path(__file__).resolve().parents[2] / "src"))

from modules.asset.permissions import (  # noqa: E402
    ASSET_ADMIN_PERMISSIONS,
    ASSET_AUDITOR_PERMISSIONS,
    ASSET_EXECUTIVE_PERMISSIONS,
    ASSET_MANAGER_PERMISSIONS,
)

revision: str = "0474_ast_warranty_governance"
down_revision: str | None = "0473_ast_audit_governance"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None

SCHEMA = "asset"
TABLE = "ast_asset_warranty"
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
    ("asset.warranty:activate", "asset.warranty", "activate", "asset"),
    ("asset.warranty:extend", "asset.warranty", "extend", "asset"),
    ("asset.warranty:expire", "asset.warranty", "expire", "asset"),
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
    sys.path.insert(0, str(Path(__file__).resolve().parents[1]))
    from helpers import index_exists

    bind = op.get_bind()

    op.execute(
        sa.text(
            f"ALTER TABLE {SCHEMA}.{TABLE} DROP CONSTRAINT IF EXISTS ck_ast_asset_warranty_status"
        )
    )
    op.create_check_constraint(
        "ck_ast_asset_warranty_status",
        TABLE,
        "status IN ('draft','active','extended','expired','void')",
        schema=SCHEMA,
    )

    index_name = "ix_ast_asset_warranty_asset_status_open"
    if not index_exists(bind, TABLE, index_name, schema=SCHEMA):
        op.create_index(
            index_name,
            TABLE,
            ["asset_id", "status"],
            schema=SCHEMA,
            postgresql_where=sa.text(
                "is_deleted = false AND status IN ('active','extended')"
            ),
        )

    # ERD §6.7 has no document_number on warranty — sequence backfill is N/A.

    conn = op.get_bind()
    now = datetime.now(timezone.utc)

    perm_ids: dict[str, str] = {}
    for code, resource, action, module in NEW_PERMISSIONS:
        perm_ids[code] = _ensure_permission(conn, now, code, resource, action, module)

    tenants = conn.execute(
        sa.text("SELECT id FROM foundation.sec_tenant WHERE is_deleted = false")
    ).fetchall()
    for (tenant_id,) in tenants:
        tid = str(tenant_id)
        for role_code, perms in ROLE_SPECS:
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
            for perm_code in perms:
                perm_id = perm_ids.get(perm_code)
                if perm_id is not None:
                    _grant(conn, now, tid, role_id, perm_id)


def downgrade() -> None:
    conn = op.get_bind()
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

    op.drop_index(
        "ix_ast_asset_warranty_asset_status_open",
        table_name=TABLE,
        schema=SCHEMA,
    )

    op.drop_constraint("ck_ast_asset_warranty_status", TABLE, schema=SCHEMA, type_="check")
    op.create_check_constraint(
        "ck_ast_asset_warranty_status",
        TABLE,
        "status IN ('active','expired','void')",
        schema=SCHEMA,
    )
