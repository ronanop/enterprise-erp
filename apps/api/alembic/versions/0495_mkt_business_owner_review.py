"""Business owner review step after marketing head draft approval."""

from __future__ import annotations

from collections.abc import Sequence
from datetime import datetime, timezone
from uuid import uuid4

import sqlalchemy as sa
from alembic import op
from sqlalchemy.dialects.postgresql import JSONB

revision: str = "0495_mkt_business_owner"
down_revision: str | None = "0494_mkt_video_editor_create"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None

PERM_CODE = "marketing.content:approve_business"


def _ensure_perm(conn, now) -> str:
    existing = conn.execute(
        sa.text(
            "SELECT id FROM foundation.sec_permission WHERE permission_code = :code LIMIT 1"
        ),
        {"code": PERM_CODE},
    ).first()
    if existing:
        return str(existing[0])
    perm_id = str(uuid4())
    conn.execute(
        sa.text(
            """
            INSERT INTO foundation.sec_permission
            (id, permission_code, resource, action, module, is_active, created_at)
            VALUES (:id, :code, :resource, :action, :module, true, :now)
            """
        ),
        {
            "id": perm_id,
            "code": PERM_CODE,
            "resource": "marketing.content",
            "action": "approve_business",
            "module": "marketing",
            "now": now,
        },
    )
    return perm_id


def _grant(conn, now, tenant_id: str, role_id: str, perm_id: str) -> None:
    exists = conn.execute(
        sa.text(
            "SELECT 1 FROM foundation.sec_role_permission WHERE role_id = :rid AND permission_id = :pid"
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
        "mkt_content_item",
        sa.Column("business_owner_review", JSONB, nullable=True),
        schema="marketing",
    )

    conn = op.get_bind()
    now = datetime.now(timezone.utc)
    perm_id = _ensure_perm(conn, now)

    # Grant to marketing head / manager demo roles so they can also act if needed
    tenants = conn.execute(
        sa.text("SELECT id FROM foundation.sec_tenant WHERE is_deleted = false")
    ).fetchall()
    for (tenant_id,) in tenants:
        tid = str(tenant_id)
        for role_code in ("MARKETING_HEAD_DEMO", "MARKETING_MANAGER", "SUPER_ADMIN", "TENANT_ADMIN"):
            role = conn.execute(
                sa.text(
                    """
                    SELECT id FROM foundation.sec_role
                    WHERE tenant_id = :tid AND role_code = :code AND is_deleted = false
                    LIMIT 1
                    """
                ),
                {"tid": tid, "code": role_code},
            ).first()
            if role:
                _grant(conn, now, tid, str(role[0]), perm_id)


def downgrade() -> None:
    op.drop_column("mkt_content_item", "business_owner_review", schema="marketing")
    conn = op.get_bind()
    conn.execute(
        sa.text("DELETE FROM foundation.sec_role_permission WHERE permission_id IN "
                "(SELECT id FROM foundation.sec_permission WHERE permission_code = :code)"),
        {"code": PERM_CODE},
    )
    conn.execute(
        sa.text("DELETE FROM foundation.sec_permission WHERE permission_code = :code"),
        {"code": PERM_CODE},
    )
