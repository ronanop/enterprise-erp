"""IT Location → Building master tables + FKs on ast_asset_location + backfill.

Additive only. Does not alter branch_id or Organization locations.
"""

from collections.abc import Sequence
from datetime import datetime, timezone
from pathlib import Path
from uuid import uuid4
import sys

import sqlalchemy as sa
from alembic import op

sys.path.insert(0, str(Path(__file__).resolve().parents[2] / "src"))

from modules.asset.models.site_building import AstBuilding  # noqa: E402, F401
from modules.asset.models.site_location import AstLocation  # noqa: E402, F401
from modules.asset.permissions import (  # noqa: E402
    ASSET_ADMIN_PERMISSIONS,
    ASSET_AUDITOR_PERMISSIONS,
    ASSET_EXECUTIVE_PERMISSIONS,
    ASSET_MANAGER_PERMISSIONS,
)

revision: str = "0576_ast_location_master"
down_revision: str | None = "0575_ast_nonit_type_details"
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
    ("asset.site:read", "asset.site", "read", "asset"),
    ("asset.site:create", "asset.site", "create", "asset"),
    ("asset.site:update", "asset.site", "update", "asset"),
]

ROLE_SPECS: list[tuple[str, list[str]]] = [
    ("ASSET_MANAGER", ASSET_MANAGER_PERMISSIONS),
    ("ASSET_EXECUTIVE", ASSET_EXECUTIVE_PERMISSIONS),
    ("ASSET_AUDITOR", ASSET_AUDITOR_PERMISSIONS),
    ("ASSET_ADMIN", ASSET_ADMIN_PERMISSIONS),
]

HO_LABEL = "New Delhi · CRC2"


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
    AstLocation.__table__.create(bind=bind, checkfirst=True)
    AstBuilding.__table__.create(bind=bind, checkfirst=True)

    op.execute(
        sa.text(
            """
            CREATE UNIQUE INDEX IF NOT EXISTS uq_ast_location_company_name_active
            ON asset.ast_location (company_id, lower(btrim(name)))
            WHERE is_deleted = false
            """
        )
    )
    op.execute(
        sa.text(
            """
            CREATE UNIQUE INDEX IF NOT EXISTS uq_ast_building_location_name_active
            ON asset.ast_building (location_id, lower(btrim(name)))
            WHERE is_deleted = false
            """
        )
    )

    op.add_column(
        "ast_asset_location",
        sa.Column("location_id", sa.Uuid(), nullable=True),
        schema="asset",
    )
    op.add_column(
        "ast_asset_location",
        sa.Column("building_id", sa.Uuid(), nullable=True),
        schema="asset",
    )
    op.create_foreign_key(
        "fk_ast_asset_location_location_id",
        "ast_asset_location",
        "ast_location",
        ["location_id"],
        ["id"],
        source_schema="asset",
        referent_schema="asset",
        ondelete="RESTRICT",
    )
    op.create_foreign_key(
        "fk_ast_asset_location_building_id",
        "ast_asset_location",
        "ast_building",
        ["building_id"],
        ["id"],
        source_schema="asset",
        referent_schema="asset",
        ondelete="RESTRICT",
    )
    op.create_index(
        "ix_ast_asset_location_location_id",
        "ast_asset_location",
        ["location_id"],
        schema="asset",
    )
    op.create_index(
        "ix_ast_asset_location_building_id",
        "ast_asset_location",
        ["building_id"],
        schema="asset",
    )

    conn = op.get_bind()
    now = datetime.now(timezone.utc)

    # Seed New Delhi / CRC2 for every company that has asset rows or companies in org.
    companies = conn.execute(
        sa.text(
            """
            SELECT DISTINCT company_id, tenant_id FROM (
                SELECT company_id, tenant_id FROM asset.ast_asset WHERE is_deleted = false
                UNION
                SELECT company_id, tenant_id FROM asset.ast_asset_location WHERE is_deleted = false
                UNION
                SELECT id AS company_id, tenant_id FROM organization.org_company WHERE is_deleted = false
            ) c
            """
        )
    ).fetchall()

    for company_id, tenant_id in companies:
        existing = conn.execute(
            sa.text(
                """
                SELECT id FROM asset.ast_location
                WHERE company_id = :cid AND is_deleted = false
                  AND lower(btrim(name)) = lower(btrim(:name))
                LIMIT 1
                """
            ),
            {"cid": company_id, "name": "New Delhi"},
        ).first()
        if existing:
            loc_id = existing[0]
            conn.execute(
                sa.text(
                    """
                    UPDATE asset.ast_location
                    SET is_head_office = true, updated_at = :now
                    WHERE id = :id
                    """
                ),
                {"id": loc_id, "now": now},
            )
        else:
            loc_id = uuid4()
            conn.execute(
                sa.text(
                    """
                    INSERT INTO asset.ast_location (
                        id, tenant_id, company_id, name, is_head_office,
                        org_location_id, version, is_deleted, created_at, updated_at
                    ) VALUES (
                        :id, :tid, :cid, :name, true,
                        NULL, 1, false, :now, :now
                    )
                    """
                ),
                {
                    "id": loc_id,
                    "tid": tenant_id,
                    "cid": company_id,
                    "name": "New Delhi",
                    "now": now,
                },
            )

        bld = conn.execute(
            sa.text(
                """
                SELECT id FROM asset.ast_building
                WHERE location_id = :lid AND is_deleted = false
                  AND lower(btrim(name)) = lower(btrim(:name))
                LIMIT 1
                """
            ),
            {"lid": loc_id, "name": "CRC2"},
        ).first()
        if bld:
            bld_id = bld[0]
        else:
            bld_id = uuid4()
            conn.execute(
                sa.text(
                    """
                    INSERT INTO asset.ast_building (
                        id, tenant_id, company_id, location_id, name,
                        version, is_deleted, created_at, updated_at
                    ) VALUES (
                        :id, :tid, :cid, :lid, :name,
                        1, false, :now, :now
                    )
                    """
                ),
                {
                    "id": bld_id,
                    "tid": tenant_id,
                    "cid": company_id,
                    "lid": loc_id,
                    "name": "CRC2",
                    "now": now,
                },
            )

        conn.execute(
            sa.text(
                """
                UPDATE asset.ast_asset_location
                SET location_id = :lid,
                    building_id = :bid,
                    location_label = :label,
                    updated_at = :now
                WHERE company_id = :cid
                  AND is_deleted = false
                  AND is_current = true
                """
            ),
            {
                "lid": loc_id,
                "bid": bld_id,
                "label": HO_LABEL,
                "cid": company_id,
                "now": now,
            },
        )

    for code, resource, action, module in NEW_PERMISSIONS:
        perm_id = _ensure_permission(conn, now, code, resource, action, module)
        for role_code, allowed in ROLE_SPECS:
            if code not in allowed:
                continue
            roles = conn.execute(
                sa.text(
                    "SELECT id, tenant_id FROM foundation.sec_role WHERE role_code = :rc"
                ),
                {"rc": role_code},
            ).fetchall()
            for role_id, tenant_id in roles:
                _grant(conn, now, tenant_id, role_id, perm_id)


def downgrade() -> None:
    op.drop_index("ix_ast_asset_location_building_id", table_name="ast_asset_location", schema="asset")
    op.drop_index("ix_ast_asset_location_location_id", table_name="ast_asset_location", schema="asset")
    op.drop_constraint(
        "fk_ast_asset_location_building_id",
        "ast_asset_location",
        schema="asset",
        type_="foreignkey",
    )
    op.drop_constraint(
        "fk_ast_asset_location_location_id",
        "ast_asset_location",
        schema="asset",
        type_="foreignkey",
    )
    op.drop_column("ast_asset_location", "building_id", schema="asset")
    op.drop_column("ast_asset_location", "location_id", schema="asset")
    op.execute(sa.text("DROP INDEX IF EXISTS asset.uq_ast_building_location_name_active"))
    op.execute(sa.text("DROP INDEX IF EXISTS asset.uq_ast_location_company_name_active"))
    op.drop_table("ast_building", schema="asset")
    op.drop_table("ast_location", schema="asset")
