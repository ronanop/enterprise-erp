"""Restore marketing tables, permissions, and roles after accidental schema drop."""

from __future__ import annotations

import sys
from collections.abc import Sequence
from datetime import datetime, timezone
from pathlib import Path
from uuid import uuid4

import sqlalchemy as sa
from alembic import op

sys.path.insert(0, str(Path(__file__).resolve().parents[2] / "src"))

from modules.marketing.models.approval import MktApproval
from modules.marketing.models.brand_voice import MktBrandVoice
from modules.marketing.models.brand_voice_source import MktBrandVoiceSource
from modules.marketing.models.calendar_entry import MktCalendarEntry
from modules.marketing.models.campaign import MktCampaign
from modules.marketing.models.competitor import MktCompetitor
from modules.marketing.models.content_pillar import MktContentPillar
from modules.marketing.models.content_request import MktContentRequest
from modules.marketing.models.generated_content import MktGeneratedContent
from modules.marketing.models.generated_content_version import MktGeneratedContentVersion
from modules.marketing.models.m365_file import MktM365File
from modules.marketing.models.m365_meeting import MktM365Meeting
from modules.marketing.models.m365_workspace import MktM365Workspace
from modules.marketing.models.ops_event import MktOpsEvent
from modules.marketing.models.platform import MktPlatform
from modules.marketing.models.publish_job import MktPublishJob
from modules.marketing.models.research_report import MktResearchReport
from modules.marketing.models.social_account import MktSocialAccount
from modules.marketing.models.social_inbox import MktSocialInbox
from modules.marketing.models.task import MktTask
from modules.marketing.models.time_entry import MktTimeEntry
from modules.marketing.models.trend_report import MktTrendReport
from modules.marketing.permissions import (
    MARKETING_ADMIN_PERMISSIONS,
    MARKETING_EDITOR_PERMISSIONS,
    MARKETING_MANAGER_PERMISSIONS,
    MARKETING_PERMISSIONS,
    MARKETING_VIEWER_PERMISSIONS,
)

revision: str = "0670_restore_marketing_module"
down_revision: str | Sequence[str] | None = "0666_crm_service_sourcing_scm_order_kind"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None

# FK-safe create order (parents before children).
_TABLES = [
    MktPlatform,
    MktCampaign,
    MktContentPillar,
    MktBrandVoice,
    MktBrandVoiceSource,
    MktSocialAccount,
    MktContentRequest,
    MktGeneratedContent,
    MktGeneratedContentVersion,
    MktResearchReport,
    MktTrendReport,
    MktCompetitor,
    MktCalendarEntry,
    MktPublishJob,
    MktTask,
    MktTimeEntry,
    MktApproval,
    MktM365Workspace,
    MktM365File,
    MktM365Meeting,
    MktOpsEvent,
    MktSocialInbox,
]

ROLE_SPECS: list[tuple[str, str, list[str]]] = [
    ("MARKETING_MANAGER", "Marketing Manager", MARKETING_MANAGER_PERMISSIONS),
    ("MARKETING_EDITOR", "Marketing Editor", MARKETING_EDITOR_PERMISSIONS),
    ("MARKETING_VIEWER", "Marketing Viewer", MARKETING_VIEWER_PERMISSIONS),
    ("MARKETING_ADMIN", "Marketing Admin", MARKETING_ADMIN_PERMISSIONS),
]

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


def _ensure_permission(conn, now, code: str, resource: str, action: str, module: str) -> str:
    exists = conn.execute(
        sa.text("SELECT id FROM foundation.sec_permission WHERE permission_code = :code"),
        {"code": code},
    ).first()
    if exists:
        conn.execute(
            sa.text(
                """
                UPDATE foundation.sec_permission
                SET is_active = true,
                    resource = :resource,
                    action = :action,
                    module = :module
                WHERE id = :id
                """
            ),
            {
                "id": str(exists[0]),
                "resource": resource,
                "action": action,
                "module": module,
            },
        )
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


def _ensure_role(conn, now, tenant_id: str, role_code: str, role_name: str) -> str:
    exists = conn.execute(
        sa.text(
            """
            SELECT id FROM foundation.sec_role
            WHERE tenant_id = :tid AND role_code = :code
            ORDER BY CASE WHEN coalesce(is_deleted, false) THEN 1 ELSE 0 END, created_at
            LIMIT 1
            """
        ),
        {"tid": tenant_id, "code": role_code},
    ).first()
    if exists:
        conn.execute(
            sa.text(
                """
                UPDATE foundation.sec_role
                SET is_deleted = false,
                    deleted_at = NULL,
                    deleted_by = NULL,
                    role_name = :name,
                    status = 'active',
                    updated_at = :now
                WHERE id = :id
                """
            ),
            {"id": str(exists[0]), "name": role_name, "now": now},
        )
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
        {
            "id": role_id,
            "tid": tenant_id,
            "code": role_code,
            "name": role_name,
            "now": now,
        },
    )
    return role_id


def _grant(conn, now, tenant_id: str, role_id: str, perm_id: str) -> None:
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
        {
            "id": str(uuid4()),
            "tid": tenant_id,
            "rid": role_id,
            "pid": perm_id,
            "now": now,
        },
    )


def upgrade() -> None:
    op.execute("CREATE SCHEMA IF NOT EXISTS marketing")

    bind = op.get_bind()
    for model in _TABLES:
        model.__table__.create(bind=bind, checkfirst=True)

    conn = op.get_bind()
    now = datetime.now(timezone.utc)

    # Reactivate any leftover marketing permissions, then ensure the full catalog.
    conn.execute(
        sa.text(
            """
            UPDATE foundation.sec_permission
            SET is_active = true
            WHERE module = 'marketing'
            """
        )
    )

    perm_ids: dict[str, str] = {}
    for code, resource, action, module in MARKETING_PERMISSIONS:
        perm_ids[code] = _ensure_permission(conn, now, code, resource, action, module)

    tenants = conn.execute(
        sa.text("SELECT id FROM foundation.sec_tenant WHERE is_deleted = false")
    ).fetchall()
    for (tenant_id,) in tenants:
        tid = str(tenant_id)
        for role_code, role_name, perms in ROLE_SPECS:
            role_id = _ensure_role(conn, now, tid, role_code, role_name)
            for perm_code in perms:
                _grant(conn, now, tid, role_id, perm_ids[perm_code])
        for role_code in ("SUPER_ADMIN", "TENANT_ADMIN"):
            role = conn.execute(
                sa.text(
                    """
                    SELECT id FROM foundation.sec_role
                    WHERE tenant_id = :tid
                      AND role_code = :code
                      AND coalesce(is_deleted, false) = false
                    LIMIT 1
                    """
                ),
                {"tid": tid, "code": role_code},
            ).first()
            if role:
                for perm_id in perm_ids.values():
                    _grant(conn, now, tid, str(role[0]), perm_id)


def downgrade() -> None:
    bind = op.get_bind()
    for model in reversed(_TABLES):
        model.__table__.drop(bind=bind, checkfirst=True)
