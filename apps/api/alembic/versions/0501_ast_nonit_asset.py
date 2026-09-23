"""Non-IT asset register tables + permissions + default asset types.

Additive only — does not alter `ast_asset` / IT tables.
"""

import sys
from collections.abc import Sequence
from datetime import datetime, timezone
from pathlib import Path
from uuid import uuid4

import sqlalchemy as sa
from alembic import op

sys.path.insert(0, str(Path(__file__).resolve().parents[2] / "src"))

from modules.asset.models.nonit_asset import AstNonitAsset  # noqa: E402, F401
from modules.asset.models.nonit_asset_type import AstNonitAssetType  # noqa: E402, F401
from modules.asset.models.nonit_location import AstNonitLocation  # noqa: E402, F401
from modules.asset.models.nonit_timeline import AstNonitAssetTimeline  # noqa: E402, F401
from modules.asset.permissions import (  # noqa: E402
    ASSET_ADMIN_PERMISSIONS,
    ASSET_AUDITOR_PERMISSIONS,
    ASSET_EXECUTIVE_PERMISSIONS,
    ASSET_MANAGER_PERMISSIONS,
)

revision: str = "0501_ast_nonit_asset"
down_revision: str | None = "0500_ast_asset_domain"
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
    ("asset.nonit_asset:read", "asset.nonit_asset", "read", "asset"),
    ("asset.nonit_asset:create", "asset.nonit_asset", "create", "asset"),
    ("asset.nonit_asset:update", "asset.nonit_asset", "update", "asset"),
    ("asset.nonit_type:read", "asset.nonit_type", "read", "asset"),
    ("asset.nonit_type:create", "asset.nonit_type", "create", "asset"),
    ("asset.nonit_type:update", "asset.nonit_type", "update", "asset"),
]

ROLE_SPECS: list[tuple[str, list[str]]] = [
    ("ASSET_MANAGER", ASSET_MANAGER_PERMISSIONS),
    ("ASSET_EXECUTIVE", ASSET_EXECUTIVE_PERMISSIONS),
    ("ASSET_AUDITOR", ASSET_AUDITOR_PERMISSIONS),
    ("ASSET_ADMIN", ASSET_ADMIN_PERMISSIONS),
]

DEFAULT_TYPES: list[tuple[str, str, str]] = [
    ("Chair", "CH", "EMPLOYEE"),
    ("Table-Desk", "TBD", "EMPLOYEE"),
    ("AC", "AC", "LOCATION"),
    ("LED TV", "TV", "LOCATION"),
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
    AstNonitAssetType.__table__.create(bind=bind, checkfirst=True)
    AstNonitLocation.__table__.create(bind=bind, checkfirst=True)
    AstNonitAsset.__table__.create(bind=bind, checkfirst=True)
    AstNonitAssetTimeline.__table__.create(bind=bind, checkfirst=True)

    conn = bind
    now = datetime.now(timezone.utc)

    # Seed default types for every existing company
    companies = conn.execute(
        sa.text(
            """
            SELECT id, tenant_id FROM organization.org_company
            WHERE is_deleted IS FALSE
            """
        )
    ).all()
    for company_id, tenant_id in companies:
        for name, prefix, mode in DEFAULT_TYPES:
            exists = conn.execute(
                sa.text(
                    """
                    SELECT 1 FROM asset.ast_nonit_asset_type
                    WHERE company_id = :cid AND prefix = :prefix AND is_deleted IS FALSE
                    """
                ),
                {"cid": str(company_id), "prefix": prefix},
            ).first()
            if exists:
                continue
            conn.execute(
                sa.text(
                    """
                    INSERT INTO asset.ast_nonit_asset_type
                    (id, tenant_id, company_id, name, prefix, active, assignment_mode,
                     metadata, created_at, created_by, updated_at, updated_by,
                     is_deleted, version)
                    VALUES
                    (:id, :tid, :cid, :name, :prefix, true, :mode,
                     NULL, :now, NULL, :now, NULL, false, 1)
                    """
                ),
                {
                    "id": str(uuid4()),
                    "tid": str(tenant_id),
                    "cid": str(company_id),
                    "name": name,
                    "prefix": prefix,
                    "mode": mode,
                    "now": now,
                },
            )

    # Seed permissions
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

    AstNonitAssetTimeline.__table__.drop(bind=bind, checkfirst=True)
    AstNonitAsset.__table__.drop(bind=bind, checkfirst=True)
    AstNonitLocation.__table__.drop(bind=bind, checkfirst=True)
    AstNonitAssetType.__table__.drop(bind=bind, checkfirst=True)
