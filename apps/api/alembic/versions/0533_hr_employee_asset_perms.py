"""Seed hr.employee_asset permissions and grant to HR role packs."""

from __future__ import annotations

import sys
from collections.abc import Sequence
from datetime import datetime, timezone
from pathlib import Path
from uuid import uuid4

import sqlalchemy as sa
from alembic import op

sys.path.insert(0, str(Path(__file__).resolve().parents[2] / "src"))

from modules.hr.permissions import (
    HR_ADMIN_PERMISSIONS,
    HR_EXECUTIVE_PERMISSIONS,
    HR_MANAGER_PERMISSIONS,
    HR_PERMISSIONS,
)

revision: str = "0533_hr_employee_asset_perms"
down_revision: str | None = "0532_ntf_event_read_at"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None

NEW_CODES = {
    "hr.employee_asset:read",
    "hr.employee_asset:assign",
    "hr.employee_asset:return",
}

ROLE_CODES = {
    "HR_ADMIN": HR_ADMIN_PERMISSIONS,
    "HR_EXECUTIVE": HR_EXECUTIVE_PERMISSIONS,
    "HR_MANAGER": HR_MANAGER_PERMISSIONS,
    "SUPER_ADMIN": list(NEW_CODES),
    "TENANT_ADMIN": list(NEW_CODES),
}


def upgrade() -> None:
    conn = op.get_bind()
    now = datetime.now(timezone.utc)

    perm_ids: dict[str, str] = {}
    for code, resource, action, module in HR_PERMISSIONS:
        if code not in NEW_CODES:
            continue
        row = conn.execute(
            sa.text("SELECT id FROM foundation.sec_permission WHERE permission_code = :code"),
            {"code": code},
        ).first()
        if row:
            perm_ids[code] = str(row[0])
            continue
        pid = str(uuid4())
        conn.execute(
            sa.text(
                """
                INSERT INTO foundation.sec_permission
                (id, permission_code, resource, action, module, is_active, created_at)
                VALUES (:id, :code, :resource, :action, :module, true, :now)
                """
            ),
            {
                "id": pid,
                "code": code,
                "resource": resource,
                "action": action,
                "module": module,
                "now": now,
            },
        )
        perm_ids[code] = pid

    tenants = conn.execute(
        sa.text("SELECT id FROM foundation.sec_tenant WHERE is_deleted = false")
    ).fetchall()
    for (tenant_id,) in tenants:
        tid = str(tenant_id)
        for role_code, codes in ROLE_CODES.items():
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
            for code in codes:
                if role_code not in ("SUPER_ADMIN", "TENANT_ADMIN") and code not in NEW_CODES:
                    continue
                if role_code in ("SUPER_ADMIN", "TENANT_ADMIN") and code not in NEW_CODES:
                    continue
                pid = perm_ids.get(code)
                if not pid:
                    continue
                exists = conn.execute(
                    sa.text(
                        """
                        SELECT 1 FROM foundation.sec_role_permission
                        WHERE role_id = :rid AND permission_id = :pid
                        """
                    ),
                    {"rid": role_id, "pid": pid},
                ).first()
                if exists:
                    continue
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
                        "tid": tid,
                        "rid": role_id,
                        "pid": pid,
                        "now": now,
                    },
                )


def downgrade() -> None:
    conn = op.get_bind()
    for code in NEW_CODES:
        row = conn.execute(
            sa.text("SELECT id FROM foundation.sec_permission WHERE permission_code = :code"),
            {"code": code},
        ).first()
        if not row:
            continue
        pid = str(row[0])
        conn.execute(
            sa.text("DELETE FROM foundation.sec_role_permission WHERE permission_id = :pid"),
            {"pid": pid},
        )
        conn.execute(
            sa.text("DELETE FROM foundation.sec_permission WHERE id = :pid"),
            {"pid": pid},
        )
