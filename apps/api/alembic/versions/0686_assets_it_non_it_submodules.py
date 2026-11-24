"""Split Assets module assignments into IT and Non-IT submodules.

Revision ID: 0686_assets_it_non_it_submodules
Revises: 0685_ast_department_manage_perms
Create Date: 2026-11-20

Idempotent: for every active sec_user_module row with module_key=assets,
ensures assets-it and assets-non-it rows exist with the same role, and
mirrors domain memberships (IT / NON_IT).
"""

from __future__ import annotations

from collections.abc import Sequence
from datetime import datetime, timezone
from uuid import uuid4

import sqlalchemy as sa
from alembic import op

revision: str = "0686_assets_it_non_it_submodules"
down_revision: str | None = "0685_ast_department_manage_perms"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None

SUBMODULES = ("assets-it", "assets-non-it")
DOMAIN_BY_SUB = {"assets-it": "IT", "assets-non-it": "NON_IT"}


def upgrade() -> None:
    conn = op.get_bind()
    now = datetime.now(timezone.utc)

    asset_rows = conn.execute(
        sa.text(
            """
            SELECT id, tenant_id, user_id, role, assigned_by, assigned_at
            FROM foundation.sec_user_module
            WHERE module_key = 'assets'
            """
        )
    ).mappings().all()

    for row in asset_rows:
        tenant_id = row["tenant_id"]
        user_id = row["user_id"]
        role = (row["role"] or "member").strip().lower() or "member"
        assigned_by = row["assigned_by"]
        assigned_at = row["assigned_at"] or now

        for sub in SUBMODULES:
            exists = conn.execute(
                sa.text(
                    """
                    SELECT 1 FROM foundation.sec_user_module
                    WHERE tenant_id = :tid AND user_id = :uid AND module_key = :key
                    """
                ),
                {"tid": tenant_id, "uid": user_id, "key": sub},
            ).first()
            if exists:
                continue
            conn.execute(
                sa.text(
                    """
                    INSERT INTO foundation.sec_user_module
                        (id, tenant_id, user_id, module_key, role, assigned_at, assigned_by)
                    VALUES
                        (:id, :tid, :uid, :key, :role, :assigned_at, :assigned_by)
                    """
                ),
                {
                    "id": str(uuid4()),
                    "tid": tenant_id,
                    "uid": user_id,
                    "key": sub,
                    "role": role,
                    "assigned_at": assigned_at,
                    "assigned_by": assigned_by,
                },
            )

        # Ensure domain memberships for both domains.
        company_id = conn.execute(
            sa.text(
                """
                SELECT id FROM organization.org_company
                WHERE tenant_id = :tid AND is_deleted = false
                ORDER BY created_at ASC
                LIMIT 1
                """
            ),
            {"tid": tenant_id},
        ).scalar()
        if company_id is None:
            continue

        membership_role = "admin" if role == "admin" else "member"
        for sub, domain in DOMAIN_BY_SUB.items():
            exists = conn.execute(
                sa.text(
                    """
                    SELECT 1 FROM asset.ast_domain_membership
                    WHERE tenant_id = :tid
                      AND user_id = :uid
                      AND domain = :domain
                      AND is_deleted = false
                    """
                ),
                {"tid": tenant_id, "uid": user_id, "domain": domain},
            ).first()
            if exists:
                continue
            conn.execute(
                sa.text(
                    """
                    INSERT INTO asset.ast_domain_membership (
                        id, tenant_id, company_id, user_id, domain, role,
                        assigned_at, assigned_by,
                        created_at, created_by, updated_at, updated_by,
                        is_deleted, version
                    ) VALUES (
                        :id, :tid, :cid, :uid, :domain, :role,
                        :assigned_at, :assigned_by,
                        :now, :assigned_by, :now, :assigned_by,
                        false, 1
                    )
                    """
                ),
                {
                    "id": str(uuid4()),
                    "tid": tenant_id,
                    "cid": company_id,
                    "uid": user_id,
                    "domain": domain,
                    "role": membership_role,
                    "assigned_at": assigned_at,
                    "assigned_by": assigned_by,
                    "now": now,
                },
            )


def downgrade() -> None:
    conn = op.get_bind()
    conn.execute(
        sa.text(
            """
            DELETE FROM foundation.sec_user_module
            WHERE module_key IN ('assets-it', 'assets-non-it')
            """
        )
    )
