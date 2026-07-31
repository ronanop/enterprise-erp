"""Resync HR role pack display names and permission grants."""

from collections.abc import Sequence
from datetime import datetime, timezone
from uuid import uuid4

import sqlalchemy as sa
from alembic import op

from modules.hr.permissions import (
    HR_ADMIN_PERMISSIONS,
    HR_EMPLOYEE_PERMISSIONS,
    HR_EXECUTIVE_PERMISSIONS,
    HR_MANAGER_PERMISSIONS,
    HR_PERMISSIONS,
)

revision: str = "0452_hr_role_packs_resync"
down_revision: str | None = "0451_hr_att_correction_early"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None

# Checklist-aligned display names
ROLE_SPECS: list[tuple[str, str, list[str]]] = [
    ("HR_EMPLOYEE", "Employee", HR_EMPLOYEE_PERMISSIONS),
    ("HR_MANAGER", "Manager", HR_MANAGER_PERMISSIONS),
    ("HR_EXECUTIVE", "HR Executive", HR_EXECUTIVE_PERMISSIONS),
    ("HR_ADMIN", "HR Admin", HR_ADMIN_PERMISSIONS),
]


def upgrade() -> None:
    conn = op.get_bind()
    now = datetime.now(timezone.utc)

    perm_ids: dict[str, str] = {}
    for code, resource, action, module in HR_PERMISSIONS:
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
        for role_code, role_name, codes in ROLE_SPECS:
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
                role_id = str(role[0])
                conn.execute(
                    sa.text(
                        """
                        UPDATE foundation.sec_role
                        SET role_name = :name, updated_at = :now
                        WHERE id = :id
                        """
                    ),
                    {"name": role_name, "now": now, "id": role_id},
                )
            else:
                role_id = str(uuid4())
                conn.execute(
                    sa.text(
                        """
                        INSERT INTO foundation.sec_role
                        (id, tenant_id, role_code, role_name, is_system_role, status,
                         created_at, updated_at, is_deleted, version)
                        VALUES (:id, :tid, :code, :name, true, 'active', :now, :now, false, 1)
                        """
                    ),
                    {
                        "id": role_id,
                        "tid": tid,
                        "code": role_code,
                        "name": role_name,
                        "now": now,
                    },
                )

            for code in codes:
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
    # Restore previous display names only
    mapping = {
        "HR_EMPLOYEE": "HR Employee",
        "HR_MANAGER": "HR Manager",
    }
    for code, name in mapping.items():
        conn.execute(
            sa.text(
                """
                UPDATE foundation.sec_role
                SET role_name = :name
                WHERE role_code = :code AND is_system_role = true
                """
            ),
            {"name": name, "code": code},
        )
