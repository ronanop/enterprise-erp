"""Seed Marketing permissions and roles."""

import sys
from collections.abc import Sequence
from datetime import datetime, timezone
from pathlib import Path
from uuid import uuid4

import sqlalchemy as sa
from alembic import op

sys.path.insert(0, str(Path(__file__).resolve().parents[2] / "src"))

from modules.marketing.permissions import (
    MARKETING_ADMIN_PERMISSIONS,
    MARKETING_ANALYST_PERMISSIONS,
    MARKETING_CREATOR_PERMISSIONS,
    MARKETING_MANAGER_PERMISSIONS,
    MARKETING_PERMISSIONS,
    MARKETING_PUBLISHER_PERMISSIONS,
    MARKETING_VIEWER_PERMISSIONS,
)

revision: str = "0480_seed_marketing_permissions"
down_revision: str | None = "0479_mkt_tables"
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

ROLE_SPECS: list[tuple[str, str, list[str]]] = [
    ("MARKETING_ADMIN", "Marketing Admin", MARKETING_ADMIN_PERMISSIONS),
    ("MARKETING_MANAGER", "Marketing Manager", MARKETING_MANAGER_PERMISSIONS),
    ("MARKETING_CREATOR", "Marketing Creator", MARKETING_CREATOR_PERMISSIONS),
    ("MARKETING_PUBLISHER", "Marketing Publisher", MARKETING_PUBLISHER_PERMISSIONS),
    ("MARKETING_ANALYST", "Marketing Analyst", MARKETING_ANALYST_PERMISSIONS),
    ("MARKETING_VIEWER", "Marketing Viewer", MARKETING_VIEWER_PERMISSIONS),
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


def _ensure_role(conn, now, tenant_id, role_code, role_name):
    exists = conn.execute(
        sa.text(
            """
            SELECT id FROM foundation.sec_role
            WHERE tenant_id = :tid AND role_code = :code AND is_deleted = false
            """
        ),
        {"tid": tenant_id, "code": role_code},
    ).first()
    if exists:
        return str(exists[0])
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
        {"id": role_id, "tid": tenant_id, "code": role_code, "name": role_name, "now": now},
    )
    return role_id


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
    perm_ids: dict[str, str] = {}
    for code, resource, action, module in MARKETING_PERMISSIONS:
        perm_ids[code] = _ensure_permission(conn, now, code, resource, action, module)

    tenants = conn.execute(sa.text("SELECT id FROM foundation.sec_tenant WHERE is_deleted = false")).fetchall()
    for (tenant_id,) in tenants:
        for role_code, role_name, perms in ROLE_SPECS:
            role_id = _ensure_role(conn, now, str(tenant_id), role_code, role_name)
            for perm in perms:
                _grant(conn, now, str(tenant_id), role_id, perm_ids[perm])


def downgrade() -> None:
    conn = op.get_bind()
    codes = [p[0] for p in MARKETING_PERMISSIONS]
    for code in codes:
        conn.execute(
            sa.text("DELETE FROM foundation.sec_role_permission WHERE permission_id IN (SELECT id FROM foundation.sec_permission WHERE permission_code = :code)"),
            {"code": code},
        )
    for code in codes:
        conn.execute(
            sa.text("DELETE FROM foundation.sec_permission WHERE permission_code = :code"),
            {"code": code},
        )
    for role_code, _, _ in ROLE_SPECS:
        conn.execute(
            sa.text("DELETE FROM foundation.sec_role WHERE role_code = :code AND is_system_role = true"),
            {"code": role_code},
        )
