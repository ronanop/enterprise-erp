"""FP-ASSET-011: maintenance plan permissions, next_due_date index, AMPL sequence backfill."""

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

revision: str = "0549_ast_maint_plan_governance"
down_revision: str | None = "0548_ast_insurance_governance"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None

SCHEMA = "asset"
TABLE = "ast_asset_maintenance_plan"
SEQ_TABLE = "ast_document_sequence"
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
    ("asset.maintenance_plan:read", "asset.maintenance_plan", "read", "asset"),
    ("asset.maintenance_plan:create", "asset.maintenance_plan", "create", "asset"),
    ("asset.maintenance_plan:update", "asset.maintenance_plan", "update", "asset"),
    ("asset.maintenance_plan:activate", "asset.maintenance_plan", "activate", "asset"),
    ("asset.maintenance_plan:pause", "asset.maintenance_plan", "pause", "asset"),
    ("asset.maintenance_plan:resume", "asset.maintenance_plan", "resume", "asset"),
    ("asset.maintenance_plan:close", "asset.maintenance_plan", "close", "asset"),
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

    index_name = "ix_ast_asset_maint_plan_next_due_active"
    if not index_exists(bind, TABLE, index_name, schema=SCHEMA):
        op.create_index(
            index_name,
            TABLE,
            ["next_due_date"],
            schema=SCHEMA,
            postgresql_where=sa.text(
                "is_deleted = false AND status = 'active'"
            ),
        )

    rows = bind.execute(
        sa.text(
            f"""
            SELECT tenant_id, company_id, document_number
            FROM {SCHEMA}.{TABLE}
            WHERE is_deleted = false
              AND document_number LIKE 'AMPL-____-%'
            """
        )
    ).fetchall()

    aggregates: dict[tuple, int] = {}
    for tenant_id, company_id, document_number in rows:
        parts = str(document_number).split("-")
        if len(parts) < 3:
            continue
        sequence_key = f"{parts[0]}-{parts[1]}"
        try:
            suffix = int(parts[2])
        except ValueError:
            continue
        key = (tenant_id, company_id, sequence_key)
        aggregates[key] = max(aggregates.get(key, 0), suffix)

    for (tenant_id, company_id, sequence_key), max_suffix in aggregates.items():
        exists = bind.execute(
            sa.text(
                f"""
                SELECT 1 FROM {SCHEMA}.{SEQ_TABLE}
                WHERE tenant_id = :tid AND company_id = :cid AND sequence_key = :key
                """
            ),
            {"tid": tenant_id, "cid": company_id, "key": sequence_key},
        ).first()
        if exists:
            bind.execute(
                sa.text(
                    f"""
                    UPDATE {SCHEMA}.{SEQ_TABLE}
                    SET next_value = GREATEST(next_value, :nv)
                    WHERE tenant_id = :tid AND company_id = :cid AND sequence_key = :key
                    """
                ),
                {
                    "nv": max_suffix + 1,
                    "tid": tenant_id,
                    "cid": company_id,
                    "key": sequence_key,
                },
            )
        else:
            bind.execute(
                sa.text(
                    f"""
                    INSERT INTO {SCHEMA}.{SEQ_TABLE}
                        (id, tenant_id, company_id, sequence_key, next_value)
                    VALUES (:id, :tid, :cid, :key, :nv)
                    """
                ),
                {
                    "id": str(uuid4()),
                    "tid": tenant_id,
                    "cid": company_id,
                    "key": sequence_key,
                    "nv": max_suffix + 1,
                },
            )

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
        "ix_ast_asset_maint_plan_next_due_active",
        table_name=TABLE,
        schema=SCHEMA,
    )
