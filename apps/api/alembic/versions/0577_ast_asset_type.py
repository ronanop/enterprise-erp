"""IT Asset Type master table + nullable FK on ast_asset + seed 7 types.

Additive only. Keeps legacy ast_asset.asset_type enum column (decision 4).
Does not alter ast_asset_category.
"""

from collections.abc import Sequence
from datetime import datetime, timezone
from pathlib import Path
from uuid import uuid4
import sys

import sqlalchemy as sa
from alembic import op

sys.path.insert(0, str(Path(__file__).resolve().parents[2] / "src"))

from modules.asset.models.asset_type import AstAssetType  # noqa: E402, F401
from modules.asset.permissions import (  # noqa: E402
    ASSET_ADMIN_PERMISSIONS,
    ASSET_AUDITOR_PERMISSIONS,
    ASSET_EXECUTIVE_PERMISSIONS,
    ASSET_MANAGER_PERMISSIONS,
)

revision: str = "0577_ast_asset_type"
down_revision: str | None = "0576_ast_location_master"
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
    ("asset.type:read", "asset.type", "read", "asset"),
    ("asset.type:create", "asset.type", "create", "asset"),
    ("asset.type:update", "asset.type", "update", "asset"),
]

ROLE_SPECS: list[tuple[str, list[str]]] = [
    ("ASSET_MANAGER", ASSET_MANAGER_PERMISSIONS),
    ("ASSET_EXECUTIVE", ASSET_EXECUTIVE_PERMISSIONS),
    ("ASSET_AUDITOR", ASSET_AUDITOR_PERMISSIONS),
    ("ASSET_ADMIN", ASSET_ADMIN_PERMISSIONS),
]

# (name, requires_hardware_config)
DEFAULT_TYPES: list[tuple[str, bool]] = [
    ("Laptop", True),
    ("Desktop", True),
    ("Monitor", False),
    ("Keyboard", False),
    ("Mouse", False),
    ("Mobile Device", True),
    ("Other", False),
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


def _grant(conn, now, tenant_id, role_id, permission_id):
    exists = conn.execute(
        sa.text(
            """
            SELECT 1 FROM foundation.sec_role_permission
            WHERE role_id = :rid AND permission_id = :pid
            """
        ),
        {"rid": role_id, "pid": permission_id},
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
        {
            "id": str(uuid4()),
            "tid": tenant_id,
            "rid": role_id,
            "pid": permission_id,
            "now": now,
        },
    )


def upgrade() -> None:
    bind = op.get_bind()
    AstAssetType.__table__.create(bind=bind, checkfirst=True)

    op.add_column(
        "ast_asset",
        sa.Column("asset_type_id", sa.Uuid(), nullable=True),
        schema="asset",
    )
    op.create_foreign_key(
        "fk_ast_asset_asset_type_id",
        "ast_asset",
        "ast_asset_type",
        ["asset_type_id"],
        ["id"],
        source_schema="asset",
        referent_schema="asset",
        ondelete="RESTRICT",
    )
    op.create_index(
        "ix_ast_asset_asset_type_id",
        "ast_asset",
        ["asset_type_id"],
        schema="asset",
    )

    conn = bind
    now = datetime.now(timezone.utc)

    companies = conn.execute(
        sa.text(
            """
            SELECT DISTINCT company_id, tenant_id
            FROM asset.ast_asset_category
            WHERE is_deleted IS FALSE
            UNION
            SELECT DISTINCT company_id, tenant_id
            FROM asset.ast_asset
            WHERE is_deleted IS FALSE
            """
        )
    ).all()
    # Also seed from org companies if category/asset empty
    if not companies:
        companies = conn.execute(
            sa.text(
                """
                SELECT id, tenant_id FROM organization.org_company
                WHERE is_deleted IS FALSE
                """
            )
        ).all()

    for company_id, tenant_id in companies:
        for name, requires_hw in DEFAULT_TYPES:
            exists = conn.execute(
                sa.text(
                    """
                    SELECT 1 FROM asset.ast_asset_type
                    WHERE company_id = :cid AND name = :name AND is_deleted IS FALSE
                    """
                ),
                {"cid": str(company_id), "name": name},
            ).first()
            if exists:
                continue
            conn.execute(
                sa.text(
                    """
                    INSERT INTO asset.ast_asset_type
                    (id, tenant_id, company_id, name, active, requires_hardware_config,
                     description, created_at, created_by, updated_at, updated_by,
                     is_deleted, version)
                    VALUES
                    (:id, :tid, :cid, :name, true, :hw,
                     NULL, :now, NULL, :now, NULL, false, 1)
                    """
                ),
                {
                    "id": str(uuid4()),
                    "tid": str(tenant_id),
                    "cid": str(company_id),
                    "name": name,
                    "hw": requires_hw,
                    "now": now,
                },
            )

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
            else [c for c in role_perm_map.get(role_code, []) if c in perm_ids]
        )
        for code in codes:
            if code in perm_ids:
                _grant(conn, now, str(tenant_id), str(role_id), perm_ids[code])


def downgrade() -> None:
    bind = op.get_bind()
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

    op.drop_index("ix_ast_asset_asset_type_id", table_name="ast_asset", schema="asset")
    op.drop_constraint("fk_ast_asset_asset_type_id", "ast_asset", schema="asset", type_="foreignkey")
    op.drop_column("ast_asset", "asset_type_id", schema="asset")
    AstAssetType.__table__.drop(bind=bind, checkfirst=True)
