"""FP-ASSET-002: asset transfer governance, workflow, and numbering."""

import sys
from collections.abc import Sequence
from datetime import datetime, timezone
from pathlib import Path
from uuid import uuid4

import sqlalchemy as sa
from alembic import op

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))
sys.path.insert(0, str(Path(__file__).resolve().parents[2] / "src"))

from helpers import (  # noqa: E402
    add_column_if_missing,
    create_fk_if_missing,
    create_index_if_missing,
)
from modules.asset.permissions import (  # noqa: E402
    ASSET_ADMIN_PERMISSIONS,
    ASSET_AUDITOR_PERMISSIONS,
    ASSET_EXECUTIVE_PERMISSIONS,
    ASSET_MANAGER_PERMISSIONS,
)

revision: str = "0466_ast_transfer_governance"
down_revision: str | None = "0465_ast_document_sequence"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None

SCHEMA = "asset"
TABLE = "ast_asset_transfer"
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
    ("asset.transfer:update", "asset.transfer", "update", "asset"),
    ("asset.transfer:submit", "asset.transfer", "submit", "asset"),
    ("asset.transfer:approve", "asset.transfer", "approve", "asset"),
]
REMOVED_PERMISSIONS = ["asset.transfer:complete"]
RESTORED_ON_DOWNGRADE = [
    ("asset.transfer:complete", "asset.transfer", "complete", "asset"),
]
TRANSFER_WORKFLOW_STEPS: list[tuple[int, str, str, str]] = [
    (1, "ASSET_EXECUTIVE", "Transfer Request Submit", "role"),
    (2, "ASSET_MANAGER", "Operational Approval", "role"),
    (3, "ASSET_ADMIN", "Asset Control Approval", "role"),
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
    add_column_if_missing(
        TABLE, sa.Column("from_location_label", sa.String(length=255), nullable=True), schema=SCHEMA
    )
    add_column_if_missing(
        TABLE, sa.Column("to_location_label", sa.String(length=255), nullable=True), schema=SCHEMA
    )
    add_column_if_missing(
        TABLE, sa.Column("from_org_location_id", sa.UUID(), nullable=True), schema=SCHEMA
    )
    add_column_if_missing(
        TABLE, sa.Column("to_org_location_id", sa.UUID(), nullable=True), schema=SCHEMA
    )
    add_column_if_missing(TABLE, sa.Column("effective_date", sa.Date(), nullable=True), schema=SCHEMA)
    add_column_if_missing(
        TABLE, sa.Column("executed_at", sa.DateTime(timezone=True), nullable=True), schema=SCHEMA
    )
    add_column_if_missing(TABLE, sa.Column("executed_by", sa.UUID(), nullable=True), schema=SCHEMA)
    add_column_if_missing(TABLE, sa.Column("transfer_notes", sa.Text(), nullable=True), schema=SCHEMA)
    add_column_if_missing(
        TABLE, sa.Column("workflow_status", sa.String(length=30), nullable=True), schema=SCHEMA
    )
    add_column_if_missing(
        TABLE, sa.Column("workflow_instance_id", sa.UUID(), nullable=True), schema=SCHEMA
    )
    create_fk_if_missing(
        "fk_ast_asset_transfer_workflow_instance",
        TABLE,
        "wf_instance",
        ["workflow_instance_id"],
        ["id"],
        source_schema=SCHEMA,
        referent_schema="foundation",
        ondelete="SET NULL",
    )
    create_index_if_missing(
        "ix_ast_asset_transfer_effective_date", TABLE, ["effective_date"], schema=SCHEMA
    )
    create_index_if_missing(
        "ix_ast_asset_transfer_workflow_instance_id",
        TABLE,
        ["workflow_instance_id"],
        schema=SCHEMA,
    )
    op.execute(
        sa.text(
            f"ALTER TABLE {SCHEMA}.{TABLE} DROP CONSTRAINT IF EXISTS ck_ast_asset_transfer_status"
        )
    )
    op.create_check_constraint(
        "ck_ast_asset_transfer_status",
        TABLE,
        "status IN ('draft','submitted','approved','completed','cancelled')",
        schema=SCHEMA,
    )

    conn = op.get_bind()
    now = datetime.now(timezone.utc)

    rows = conn.execute(
        sa.text(
            """
            SELECT tenant_id, company_id, document_number
            FROM asset.ast_asset_transfer
            WHERE is_deleted = false
              AND document_number LIKE 'ATRF-____-%'
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
        conn.execute(
            sa.text(
                """
                INSERT INTO asset.ast_document_sequence
                    (id, tenant_id, company_id, sequence_key, next_value)
                VALUES (:id, :tenant_id, :company_id, :sequence_key, :next_value)
                ON CONFLICT (tenant_id, company_id, sequence_key)
                DO UPDATE SET next_value = GREATEST(asset.ast_document_sequence.next_value, EXCLUDED.next_value)
                """
            ),
            {
                "id": uuid4(),
                "tenant_id": tenant_id,
                "company_id": company_id,
                "sequence_key": sequence_key,
                "next_value": max_suffix + 1,
            },
        )

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

    for code in REMOVED_PERMISSIONS:
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

    for (tenant_id,) in tenants:
        tid = str(tenant_id)
        exists = conn.execute(
            sa.text(
                """
                SELECT id FROM foundation.wf_definition
                WHERE tenant_id = :tid AND workflow_code = :code AND version_no = 1
                """
            ),
            {"tid": tid, "code": "AST_TRANSFER_APPROVAL"},
        ).first()
        if exists:
            workflow_id = str(exists[0])
        else:
            workflow_id = str(uuid4())
            conn.execute(
                sa.text(
                    """
                    INSERT INTO foundation.wf_definition
                    (id, tenant_id, workflow_code, workflow_name, module,
                     document_type, version_no, is_active, created_at, updated_at)
                    VALUES (:id, :tid, :code, :name, 'asset', :doc, 1, true, :now, :now)
                    """
                ),
                {
                    "id": workflow_id,
                    "tid": tid,
                    "code": "AST_TRANSFER_APPROVAL",
                    "name": "Asset Transfer Approval",
                    "doc": "ast_asset_transfer",
                    "now": now,
                },
            )
        for step_order, step_code, step_name, approver_type in TRANSFER_WORKFLOW_STEPS:
            step_exists = conn.execute(
                sa.text(
                    """
                    SELECT 1 FROM foundation.wf_step
                    WHERE workflow_id = :wid AND step_order = :ord
                    """
                ),
                {"wid": workflow_id, "ord": step_order},
            ).first()
            if step_exists:
                continue
            conn.execute(
                sa.text(
                    """
                    INSERT INTO foundation.wf_step
                    (id, tenant_id, workflow_id, step_order, step_code, step_name,
                     approver_type, is_parallel, created_at, updated_at)
                    VALUES (:id, :tid, :wid, :ord, :code, :name, :atype, false, :now, :now)
                    """
                ),
                {
                    "id": str(uuid4()),
                    "tid": tid,
                    "wid": workflow_id,
                    "ord": step_order,
                    "code": step_code,
                    "name": step_name,
                    "atype": approver_type,
                    "now": now,
                },
            )


def downgrade() -> None:
    conn = op.get_bind()
    now = datetime.now(timezone.utc)

    for code in ("AST_TRANSFER_APPROVAL",):
        conn.execute(
            sa.text(
                """
                DELETE FROM foundation.wf_step
                WHERE workflow_id IN (
                    SELECT id FROM foundation.wf_definition WHERE workflow_code = :code
                )
                """
            ),
            {"code": code},
        )
        conn.execute(
            sa.text("DELETE FROM foundation.wf_definition WHERE workflow_code = :code"),
            {"code": code},
        )

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

    restored_ids: dict[str, str] = {}
    for code, resource, action, module in RESTORED_ON_DOWNGRADE:
        restored_ids[code] = _ensure_permission(conn, now, code, resource, action, module)

    tenants = conn.execute(
        sa.text("SELECT id FROM foundation.sec_tenant WHERE is_deleted = false")
    ).fetchall()
    complete_perm_id = restored_ids.get("asset.transfer:complete")
    for (tenant_id,) in tenants:
        tid = str(tenant_id)
        if complete_perm_id:
            for role_code in ("ASSET_MANAGER", "ASSET_ADMIN"):
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
                    _grant(conn, now, tid, str(role[0]), complete_perm_id)

    op.drop_index("ix_ast_asset_transfer_workflow_instance_id", table_name=TABLE, schema=SCHEMA)
    op.drop_index("ix_ast_asset_transfer_effective_date", table_name=TABLE, schema=SCHEMA)
    op.drop_constraint("fk_ast_asset_transfer_workflow_instance", TABLE, schema=SCHEMA, type_="foreignkey")
    op.drop_constraint("ck_ast_asset_transfer_status", TABLE, schema=SCHEMA, type_="check")
    op.create_check_constraint(
        "ck_ast_asset_transfer_status",
        TABLE,
        "status IN ('draft','completed','cancelled')",
        schema=SCHEMA,
    )
    for column in (
        "workflow_instance_id",
        "workflow_status",
        "transfer_notes",
        "executed_by",
        "executed_at",
        "effective_date",
        "to_org_location_id",
        "from_org_location_id",
        "to_location_label",
        "from_location_label",
    ):
        op.drop_column(TABLE, column, schema=SCHEMA)
