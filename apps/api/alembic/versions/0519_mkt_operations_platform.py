"""Marketing operations tables, campaign expansions, and ops permissions."""

import sys
from collections.abc import Sequence
from datetime import datetime, timezone
from pathlib import Path
from uuid import uuid4

import sqlalchemy as sa
from alembic import op

sys.path.insert(0, str(Path(__file__).resolve().parents[2] / "src"))

from modules.marketing.models.approval import MktApproval
from modules.marketing.models.m365_file import MktM365File
from modules.marketing.models.m365_meeting import MktM365Meeting
from modules.marketing.models.m365_workspace import MktM365Workspace
from modules.marketing.models.ops_event import MktOpsEvent
from modules.marketing.models.task import MktTask
from modules.marketing.models.time_entry import MktTimeEntry
from modules.marketing.permissions import MARKETING_PERMISSIONS

revision: str = "0519_mkt_operations_platform"
down_revision: str | Sequence[str] | None = "0518_grant_marketing_admin_perms"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None

_NEW_TABLES = [
    MktTask,
    MktTimeEntry,
    MktApproval,
    MktM365Workspace,
    MktM365File,
    MktM365Meeting,
    MktOpsEvent,
]

OPS_CODES = [
    "marketing.task:read",
    "marketing.task:create",
    "marketing.task:update",
    "marketing.approval:read",
    "marketing.approval:act",
    "marketing.m365:read",
    "marketing.m365:update",
    "marketing.workload:read",
    "marketing.ops:read",
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


def upgrade() -> None:
    op.execute("ALTER TABLE marketing.mkt_campaign DROP CONSTRAINT IF EXISTS ck_mkt_campaign_type")
    op.execute("ALTER TABLE marketing.mkt_campaign DROP CONSTRAINT IF EXISTS ck_mkt_campaign_priority")
    op.execute("ALTER TABLE marketing.mkt_content_request DROP CONSTRAINT IF EXISTS ck_mkt_content_request_type")
    op.execute("ALTER TABLE marketing.mkt_campaign ADD COLUMN IF NOT EXISTS priority VARCHAR(20) NOT NULL DEFAULT 'medium'")
    op.execute("ALTER TABLE marketing.mkt_campaign ADD COLUMN IF NOT EXISTS success_metrics JSONB")
    op.execute("ALTER TABLE marketing.mkt_campaign ADD COLUMN IF NOT EXISTS stakeholders JSONB")
    op.execute("ALTER TABLE marketing.mkt_campaign ADD COLUMN IF NOT EXISTS departments JSONB")
    op.execute("ALTER TABLE marketing.mkt_campaign ADD COLUMN IF NOT EXISTS approvers JSONB")
    op.execute("ALTER TABLE marketing.mkt_content_request ADD COLUMN IF NOT EXISTS purpose VARCHAR(255)")
    op.execute("ALTER TABLE marketing.mkt_content_request ADD COLUMN IF NOT EXISTS technical_depth VARCHAR(40)")
    op.execute("ALTER TABLE marketing.mkt_content_request ADD COLUMN IF NOT EXISTS keywords TEXT")
    op.execute("ALTER TABLE marketing.mkt_content_request ADD COLUMN IF NOT EXISTS reference_notes TEXT")
    op.execute("ALTER TABLE marketing.mkt_content_request ADD COLUMN IF NOT EXISTS assigned_to_user_id UUID")
    op.execute("ALTER TABLE marketing.mkt_content_request ADD COLUMN IF NOT EXISTS due_at TIMESTAMPTZ")
    op.execute(
        """
        ALTER TABLE marketing.mkt_campaign ADD CONSTRAINT ck_mkt_campaign_type CHECK (
            campaign_type IN (
                'brand','product','social','email','event','mixed',
                'product_launch','webinar','social_campaign','lead_generation',
                'brand_awareness','customer_success','partner_marketing','internal_communication'
            )
        )
        """
    )
    op.execute(
        """
        ALTER TABLE marketing.mkt_campaign ADD CONSTRAINT ck_mkt_campaign_priority CHECK (
            priority IN ('low','medium','high','critical')
        )
        """
    )
    op.execute(
        """
        ALTER TABLE marketing.mkt_content_request ADD CONSTRAINT ck_mkt_content_request_type CHECK (
            content_type IN (
                'post','thread','blog','newsletter','script','ad','carousel','other',
                'whitepaper','case_study','landing_page','press_release','email',
                'ad_copy','event_content'
            )
        )
        """
    )
    bind = op.get_bind()
    for model in _NEW_TABLES:
        model.__table__.create(bind=bind, checkfirst=True)

    conn = op.get_bind()
    now = datetime.now(timezone.utc)
    perm_ids: dict[str, str] = {}
    for code, resource, action, module in MARKETING_PERMISSIONS:
        if code not in OPS_CODES:
            continue
        exists = conn.execute(
            sa.text("SELECT id FROM foundation.sec_permission WHERE permission_code = :code"),
            {"code": code},
        ).first()
        if exists:
            perm_ids[code] = str(exists[0])
            continue
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
        perm_ids[code] = perm_id

    tenants = conn.execute(sa.text("SELECT id FROM foundation.sec_tenant WHERE is_deleted = false")).fetchall()
    role_codes = (
        "SUPER_ADMIN",
        "TENANT_ADMIN",
        "MARKETING_ADMIN",
        "MARKETING_MANAGER",
        "MARKETING_EDITOR",
        "MARKETING_VIEWER",
    )
    for (tenant_id,) in tenants:
        tid = str(tenant_id)
        for role_code in role_codes:
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
            for code, perm_id in perm_ids.items():
                if role_code == "MARKETING_VIEWER" and not code.endswith(":read"):
                    continue
                if role_code == "MARKETING_EDITOR" and code in {"marketing.approval:act"}:
                    continue
                exists = conn.execute(
                    sa.text(
                        """
                        SELECT 1 FROM foundation.sec_role_permission
                        WHERE role_id = :rid AND permission_id = :pid
                        """
                    ),
                    {"rid": str(role[0]), "pid": perm_id},
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
                    {"id": str(uuid4()), "tid": tid, "rid": str(role[0]), "pid": perm_id, "now": now},
                )


def downgrade() -> None:
    bind = op.get_bind()
    for model in reversed(_NEW_TABLES):
        model.__table__.drop(bind=bind, checkfirst=True)
