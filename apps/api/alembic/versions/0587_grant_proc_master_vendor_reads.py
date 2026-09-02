"""Grant master vendor read/create/update to procurement roles."""

import sys
from collections.abc import Sequence
from datetime import datetime, timezone
from pathlib import Path
from uuid import uuid4

import sqlalchemy as sa
from alembic import op

sys.path.insert(0, str(Path(__file__).resolve().parents[2] / "src"))

from modules.procurement.permissions import (
    BUYER_PERMISSIONS,
    FINANCE_REVIEWER_PERMISSIONS,
    PROCUREMENT_MANAGER_PERMISSIONS,
)

revision: str = "0587_grant_proc_master_vendor_reads"
down_revision: str | None = "0586_crm_quote_address_amc"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None

ROLE_SPECS: list[tuple[str, list[str]]] = [
    ("BUYER", BUYER_PERMISSIONS),
    ("PROCUREMENT_MANAGER", PROCUREMENT_MANAGER_PERMISSIONS),
    ("FINANCE_REVIEWER_PROC", FINANCE_REVIEWER_PERMISSIONS),
]

VENDOR_CODES = (
    "master.vendor:read",
    "master.vendor:create",
    "master.vendor:update",
)


def _grant(conn, now: datetime, tenant_id: str, role_id: str, perm_id: str) -> None:
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
    for code in VENDOR_CODES:
        row = conn.execute(
            sa.text("SELECT id FROM foundation.sec_permission WHERE permission_code = :code"),
            {"code": code},
        ).first()
        if row:
            perm_ids[code] = str(row[0])

    if not perm_ids:
        return

    tenants = conn.execute(
        sa.text("SELECT id FROM foundation.sec_tenant WHERE is_deleted = false")
    ).fetchall()

    granted_codes: set[str] = set()
    for _, codes in ROLE_SPECS:
        granted_codes.update(codes)

    for (tenant_id,) in tenants:
        tid = str(tenant_id)
        for role_code, codes in ROLE_SPECS:
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
            if not role:
                continue
            role_id = str(role[0])
            for code in codes:
                if code not in VENDOR_CODES:
                    continue
                pid = perm_ids.get(code)
                if pid:
                    _grant(conn, now, tid, role_id, pid)


def downgrade() -> None:
    conn = op.get_bind()
    conn.execute(
        sa.text(
            """
            DELETE FROM foundation.sec_role_permission rp
            USING foundation.sec_role r, foundation.sec_permission p
            WHERE rp.role_id = r.id
              AND rp.permission_id = p.id
              AND r.role_code IN ('BUYER', 'PROCUREMENT_MANAGER', 'FINANCE_REVIEWER_PROC')
              AND p.permission_code IN (
                'master.vendor:read',
                'master.vendor:create',
                'master.vendor:update'
              )
            """
        )
    )
