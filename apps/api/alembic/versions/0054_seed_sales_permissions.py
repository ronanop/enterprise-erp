"""Seed sales permissions and roles."""

from collections.abc import Sequence
from datetime import datetime, timezone
from uuid import uuid4

import sqlalchemy as sa
from alembic import op

revision: str = "0054_seed_sales_permissions"
down_revision: str | None = "0053_sales_return_line"
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


def _ensure_permission(
    conn, now: datetime, code: str, resource: str, action: str, module: str
) -> str:
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


def _ensure_role(conn, now: datetime, tenant_id: str, role_code: str, role_name: str) -> str:
    exists = conn.execute(
        sa.text(
            """
            SELECT id FROM foundation.sec_role
            WHERE tenant_id = :tid AND role_code = :code AND is_deleted = false
            """
        ),
        {"tid": tenant_id, "code": role_code},
    ).first()
    if exists:
        return str(exists[0])
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
        {"id": role_id, "tid": tenant_id, "code": role_code, "name": role_name, "now": now},
    )
    return role_id


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
    try:
        from modules.sales.permissions import (
            FINANCE_REVIEWER_PERMISSIONS,
            SALES_EXECUTIVE_PERMISSIONS,
            SALES_MANAGER_PERMISSIONS,
            SALES_PERMISSIONS,
        )
    except ModuleNotFoundError:
        # Sales module removed; historical seed already applied on existing DBs.
        return

    role_specs: list[tuple[str, str, list[str]]] = [
        ("SALES_EXECUTIVE", "Sales Executive", SALES_EXECUTIVE_PERMISSIONS),
        ("SALES_MANAGER", "Sales Manager", SALES_MANAGER_PERMISSIONS),
        ("FINANCE_REVIEWER", "Finance Reviewer (Sales)", FINANCE_REVIEWER_PERMISSIONS),
    ]

    conn = op.get_bind()
    now = datetime.now(timezone.utc)
    perm_map: dict[str, str] = {}

    for code, resource, action, module in SALES_PERMISSIONS:
        perm_map[code] = _ensure_permission(conn, now, code, resource, action, module)

    tenants = conn.execute(
        sa.text("SELECT id FROM foundation.sec_tenant WHERE is_deleted = false")
    ).fetchall()

    for (tenant_id,) in tenants:
        tid = str(tenant_id)
        for role_code, role_name, perm_codes in role_specs:
            role_id = _ensure_role(conn, now, tid, role_code, role_name)
            for perm_code in perm_codes:
                perm_id = perm_map.get(perm_code)
                if perm_id:
                    _grant(conn, now, tid, role_id, perm_id)

        for role_code in ("SUPER_ADMIN", "TENANT_ADMIN"):
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
                for perm_id in perm_map.values():
                    _grant(conn, now, tid, str(role[0]), perm_id)


def downgrade() -> None:
    try:
        from modules.sales.permissions import (
            SALES_EXECUTIVE_PERMISSIONS,
            SALES_MANAGER_PERMISSIONS,
            FINANCE_REVIEWER_PERMISSIONS,
            SALES_PERMISSIONS,
        )
    except ModuleNotFoundError:
        return

    role_codes = [
        "SALES_EXECUTIVE",
        "SALES_MANAGER",
        "FINANCE_REVIEWER",
    ]
    # silence unused import warnings for role constant lists
    _ = (SALES_EXECUTIVE_PERMISSIONS, SALES_MANAGER_PERMISSIONS, FINANCE_REVIEWER_PERMISSIONS)
    perm_codes = [p[0] for p in SALES_PERMISSIONS]
    conn = op.get_bind()

    for code in role_codes:
        conn.execute(
            sa.text(
                """
                DELETE FROM foundation.sec_role_permission
                WHERE role_id IN (
                    SELECT id FROM foundation.sec_role WHERE role_code = :code
                )
                """
            ),
            {"code": code},
        )
        conn.execute(
            sa.text("DELETE FROM foundation.sec_role WHERE role_code = :code"),
            {"code": code},
        )

    for code in perm_codes:
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
