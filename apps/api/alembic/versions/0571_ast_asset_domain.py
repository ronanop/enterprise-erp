"""Add asset_domain + ast_domain_membership + asset.module:admin permission.

Additive only — no destructive changes to existing columns/data.
"""

import sys
from collections.abc import Sequence
from datetime import datetime, timezone
from pathlib import Path
from uuid import uuid4

import sqlalchemy as sa
from alembic import op

sys.path.insert(0, str(Path(__file__).resolve().parents[2] / "src"))

from modules.asset.models.domain_membership import AstDomainMembership  # noqa: E402, F401
from modules.asset.permissions import (  # noqa: E402
    ASSET_ADMIN_PERMISSIONS,
    ASSET_MANAGER_PERMISSIONS,
)

revision: str = "0571_ast_asset_domain"
down_revision: str | None = "0570_ast_assignment_manual_employee"
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

NEW_PERMISSIONS = [
    ("asset.module:admin", "asset.module", "admin", "asset"),
]

# Only manager/admin roles get the module-admin gate (not executive/auditor).
ROLE_SPECS: list[tuple[str, list[str]]] = [
    ("ASSET_MANAGER", ASSET_MANAGER_PERMISSIONS),
    ("ASSET_ADMIN", ASSET_ADMIN_PERMISSIONS),
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
    # --- A. asset_domain on ast_asset (default IT, backfill existing) ---
    op.add_column(
        "ast_asset",
        sa.Column(
            "asset_domain",
            sa.String(20),
            nullable=True,
        ),
        schema="asset",
    )
    op.execute(sa.text("UPDATE asset.ast_asset SET asset_domain = 'IT' WHERE asset_domain IS NULL"))
    op.alter_column(
        "ast_asset",
        "asset_domain",
        existing_type=sa.String(20),
        nullable=False,
        server_default="IT",
        schema="asset",
    )
    op.create_check_constraint(
        "ck_ast_asset_domain",
        "ast_asset",
        "asset_domain IN ('IT','NON_IT')",
        schema="asset",
    )
    op.create_index(
        "ix_ast_asset_asset_domain",
        "ast_asset",
        ["asset_domain"],
        schema="asset",
    )

    # --- A. asset_domain on ast_asset_category (nullable; backfill existing to IT) ---
    op.add_column(
        "ast_asset_category",
        sa.Column("asset_domain", sa.String(20), nullable=True),
        schema="asset",
    )
    op.execute(
        sa.text("UPDATE asset.ast_asset_category SET asset_domain = 'IT' WHERE asset_domain IS NULL")
    )
    op.create_check_constraint(
        "ck_ast_asset_category_domain",
        "ast_asset_category",
        "asset_domain IS NULL OR asset_domain IN ('IT','NON_IT')",
        schema="asset",
    )
    op.create_index(
        "ix_ast_asset_category_asset_domain",
        "ast_asset_category",
        ["asset_domain"],
        schema="asset",
    )

    # --- B. domain membership table ---
    bind = op.get_bind()
    AstDomainMembership.__table__.create(bind=bind, checkfirst=True)

    # --- B. seed asset.module:admin ---
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
                'ASSET_MANAGER','ASSET_ADMIN','SUPER_ADMIN','TENANT_ADMIN'
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
            else [c for c in role_perm_map.get(role_code, []) if c in perm_ids]
        )
        for code in codes:
            if code in perm_ids:
                _grant(conn, now, str(tenant_id), str(role_id), perm_ids[code])


def downgrade() -> None:
    bind = op.get_bind()
    AstDomainMembership.__table__.drop(bind=bind, checkfirst=True)

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

    op.drop_index("ix_ast_asset_category_asset_domain", table_name="ast_asset_category", schema="asset")
    op.drop_constraint("ck_ast_asset_category_domain", "ast_asset_category", schema="asset")
    op.drop_column("ast_asset_category", "asset_domain", schema="asset")

    op.drop_index("ix_ast_asset_asset_domain", table_name="ast_asset", schema="asset")
    op.drop_constraint("ck_ast_asset_domain", "ast_asset", schema="asset")
    op.drop_column("ast_asset", "asset_domain", schema="asset")
