"""Extend incoming asset tables for Sub-phase 2 QC + permissions."""

from collections.abc import Sequence
from datetime import datetime, timezone
from pathlib import Path
from uuid import uuid4
import sys

import sqlalchemy as sa
from alembic import op

sys.path.insert(0, str(Path(__file__).resolve().parents[2] / "src"))

from modules.asset.models.incoming_asset import AstIncomingQcEvent  # noqa: E402, F401
from modules.asset.permissions import (  # noqa: E402
    ASSET_ADMIN_PERMISSIONS,
    ASSET_AUDITOR_PERMISSIONS,
    ASSET_EXECUTIVE_PERMISSIONS,
    ASSET_MANAGER_PERMISSIONS,
)

revision: str = "0562_ast_incoming_qc"
down_revision: str | None = "0561_ast_incoming_asset"
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
    ("asset.incoming_qc:read", "asset.incoming_qc", "read", "asset"),
    ("asset.incoming_qc:inspect", "asset.incoming_qc", "inspect", "asset"),
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
    op.add_column(
        "ast_incoming_asset_line",
        sa.Column(
            "accepted_quantity",
            sa.Numeric(18, 4),
            nullable=False,
            server_default="0",
        ),
        schema="asset",
    )
    op.add_column(
        "ast_incoming_asset_line",
        sa.Column(
            "rejected_quantity",
            sa.Numeric(18, 4),
            nullable=False,
            server_default="0",
        ),
        schema="asset",
    )
    op.add_column(
        "ast_incoming_asset_line",
        sa.Column(
            "qc_status",
            sa.String(30),
            nullable=False,
            server_default="PENDING",
        ),
        schema="asset",
    )
    op.add_column(
        "ast_incoming_asset_line",
        sa.Column("qc_started_at", sa.DateTime(timezone=True), nullable=True),
        schema="asset",
    )
    op.add_column(
        "ast_incoming_asset_line",
        sa.Column("qc_started_by", sa.Uuid(), nullable=True),
        schema="asset",
    )
    op.add_column(
        "ast_incoming_asset_line",
        sa.Column("qc_notes", sa.Text(), nullable=True),
        schema="asset",
    )
    op.add_column(
        "ast_incoming_asset_line",
        sa.Column("quality_inspection_id", sa.Uuid(), nullable=True),
        schema="asset",
    )
    op.create_index(
        "ix_ast_incoming_line_qc_status",
        "ast_incoming_asset_line",
        ["qc_status"],
        schema="asset",
    )
    op.create_index(
        "ix_ast_incoming_line_quality_inspection_id",
        "ast_incoming_asset_line",
        ["quality_inspection_id"],
        schema="asset",
    )
    op.create_check_constraint(
        "ck_ast_incoming_line_accepted_nonneg",
        "ast_incoming_asset_line",
        "accepted_quantity >= 0",
        schema="asset",
    )
    op.create_check_constraint(
        "ck_ast_incoming_line_rejected_nonneg",
        "ast_incoming_asset_line",
        "rejected_quantity >= 0",
        schema="asset",
    )
    op.create_check_constraint(
        "ck_ast_incoming_line_qc_lte_arrived",
        "ast_incoming_asset_line",
        "accepted_quantity + rejected_quantity <= arrived_quantity",
        schema="asset",
    )
    op.create_check_constraint(
        "ck_ast_incoming_line_qc_status",
        "ast_incoming_asset_line",
        "qc_status IN ('PENDING','IN_PROGRESS','ACCEPTED','REJECTED')",
        schema="asset",
    )

    op.add_column(
        "ast_incoming_asset_unit",
        sa.Column(
            "qc_status",
            sa.String(30),
            nullable=False,
            server_default="PENDING_QC",
        ),
        schema="asset",
    )
    op.add_column(
        "ast_incoming_asset_unit",
        sa.Column("tested_at", sa.DateTime(timezone=True), nullable=True),
        schema="asset",
    )
    op.add_column(
        "ast_incoming_asset_unit",
        sa.Column("tested_by", sa.Uuid(), nullable=True),
        schema="asset",
    )
    op.add_column(
        "ast_incoming_asset_unit",
        sa.Column("qc_notes", sa.Text(), nullable=True),
        schema="asset",
    )
    op.add_column(
        "ast_incoming_asset_unit",
        sa.Column("rejection_reason", sa.String(500), nullable=True),
        schema="asset",
    )
    op.add_column(
        "ast_incoming_asset_unit",
        sa.Column("evidence_uri", sa.String(500), nullable=True),
        schema="asset",
    )
    op.add_column(
        "ast_incoming_asset_unit",
        sa.Column("quality_inspection_id", sa.Uuid(), nullable=True),
        schema="asset",
    )
    op.create_index(
        "ix_ast_incoming_unit_qc_status",
        "ast_incoming_asset_unit",
        ["qc_status"],
        schema="asset",
    )
    op.create_check_constraint(
        "ck_ast_incoming_unit_qc_status",
        "ast_incoming_asset_unit",
        "qc_status IN ('PENDING_QC','ACCEPTED','REJECTED')",
        schema="asset",
    )

    bind = op.get_bind()
    AstIncomingQcEvent.__table__.create(bind=bind, checkfirst=True)

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
            WHERE role_code IN ('ASSET_MANAGER','ASSET_EXECUTIVE','ASSET_AUDITOR','ASSET_ADMIN')
              AND is_deleted IS FALSE
            """
        )
    ).all()
    role_perm_map = {code: perms for code, perms in ROLE_SPECS}
    for role_id, tenant_id, role_code in roles:
        for code in role_perm_map.get(role_code, []):
            if code in perm_ids:
                _grant(conn, now, str(tenant_id), str(role_id), perm_ids[code])


def downgrade() -> None:
    bind = op.get_bind()
    AstIncomingQcEvent.__table__.drop(bind=bind, checkfirst=True)

    op.drop_constraint(
        "ck_ast_incoming_unit_qc_status",
        "ast_incoming_asset_unit",
        schema="asset",
        type_="check",
    )
    op.drop_index(
        "ix_ast_incoming_unit_qc_status",
        table_name="ast_incoming_asset_unit",
        schema="asset",
    )
    for col in (
        "quality_inspection_id",
        "evidence_uri",
        "rejection_reason",
        "qc_notes",
        "tested_by",
        "tested_at",
        "qc_status",
    ):
        op.drop_column("ast_incoming_asset_unit", col, schema="asset")

    for name in (
        "ck_ast_incoming_line_qc_status",
        "ck_ast_incoming_line_qc_lte_arrived",
        "ck_ast_incoming_line_rejected_nonneg",
        "ck_ast_incoming_line_accepted_nonneg",
    ):
        op.drop_constraint(name, "ast_incoming_asset_line", schema="asset", type_="check")
    op.drop_index(
        "ix_ast_incoming_line_quality_inspection_id",
        table_name="ast_incoming_asset_line",
        schema="asset",
    )
    op.drop_index(
        "ix_ast_incoming_line_qc_status",
        table_name="ast_incoming_asset_line",
        schema="asset",
    )
    for col in (
        "quality_inspection_id",
        "qc_notes",
        "qc_started_by",
        "qc_started_at",
        "qc_status",
        "rejected_quantity",
        "accepted_quantity",
    ):
        op.drop_column("ast_incoming_asset_line", col, schema="asset")
