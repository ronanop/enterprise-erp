"""Seed helpdesk workflow definitions per ERD_17."""

from collections.abc import Sequence
from datetime import datetime, timezone
from uuid import uuid4

import sqlalchemy as sa
from alembic import op

revision: str = "0310_seed_helpdesk_workflows"
down_revision: str | None = "0309_seed_helpdesk_permissions"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None

WORKFLOWS: list[tuple[str, str, str, list[tuple[int, str, str, str]]]] = [
    (
        "HD_TICKET_APPROVAL",
        "Helpdesk Ticket Approval",
        "hd_ticket",
        [
            (1, "HELPDESK_AGENT", "Agent Submit", "role"),
            (2, "HELPDESK_MANAGER", "Helpdesk Manager Approval", "role"),
        ],
    ),
    (
        "HD_ASSIGNMENT_APPROVAL",
        "Helpdesk Assignment Approval",
        "hd_ticket_assignment",
        [
            (1, "HELPDESK_AGENT", "Coordinator Submit", "role"),
            (2, "HELPDESK_MANAGER", "Helpdesk Manager Approval", "role"),
        ],
    ),
    (
        "HD_SLA_ESCALATION",
        "Helpdesk SLA Escalation",
        "hd_ticket_escalation",
        [
            (1, "HELPDESK_AGENT", "Agent Escalation", "role"),
            (2, "SUPPORT_ENGINEER", "Supervisor Escalation", "role"),
            (3, "HELPDESK_MANAGER", "Manager Escalation", "role"),
        ],
    ),
    (
        "HD_RESOLUTION_APPROVAL",
        "Helpdesk Resolution Approval",
        "hd_resolution",
        [
            (1, "SUPPORT_ENGINEER", "Engineer Submit", "role"),
            (2, "HELPDESK_MANAGER", "Helpdesk Manager Approval", "role"),
        ],
    ),
    (
        "HD_KNOWLEDGE_APPROVAL",
        "Helpdesk Knowledge Approval",
        "hd_knowledge_article",
        [
            (1, "SUPPORT_ENGINEER", "Author Submit", "role"),
            (2, "HELPDESK_MANAGER", "Helpdesk Manager Approval", "role"),
            (3, "HELPDESK_ADMIN", "Admin Publish", "role"),
        ],
    ),
]


def upgrade() -> None:
    conn = op.get_bind()
    now = datetime.now(timezone.utc)
    tenants = conn.execute(
        sa.text("SELECT id FROM foundation.sec_tenant WHERE is_deleted = false")
    ).fetchall()
    for (tenant_id,) in tenants:
        tid = str(tenant_id)
        for workflow_code, workflow_name, document_type, steps in WORKFLOWS:
            exists = conn.execute(
                sa.text(
                    """
                    SELECT id FROM foundation.wf_definition
                    WHERE tenant_id = :tid AND workflow_code = :code AND version_no = 1
                    """
                ),
                {"tid": tid, "code": workflow_code},
            ).first()
            if exists:
                wf_id = str(exists[0])
            else:
                wf_id = str(uuid4())
                conn.execute(
                    sa.text(
                        """
                        INSERT INTO foundation.wf_definition
                        (id, tenant_id, workflow_code, workflow_name, module,
                         document_type, version_no, is_active, created_at, updated_at)
                        VALUES (:id, :tid, :code, :name, 'helpdesk', :doc, 1, true, :now, :now)
                        """
                    ),
                    {
                        "id": wf_id,
                        "tid": tid,
                        "code": workflow_code,
                        "name": workflow_name,
                        "doc": document_type,
                        "now": now,
                    },
                )
            for step_order, step_code, step_name, approver_type in steps:
                step_exists = conn.execute(
                    sa.text(
                        """
                        SELECT 1 FROM foundation.wf_step
                        WHERE workflow_id = :wid AND step_order = :ord
                        """
                    ),
                    {"wid": wf_id, "ord": step_order},
                ).first()
                if step_exists:
                    continue
                conn.execute(
                    sa.text(
                        """
                        INSERT INTO foundation.wf_step
                        (id, tenant_id, workflow_id, step_order, step_code, step_name,
                         approver_type, is_parallel, created_at, updated_at)
                        VALUES (:id, :tid, :wid, :ord, :code, :name, :atype, false, :now, :now)
                        """
                    ),
                    {
                        "id": str(uuid4()),
                        "tid": tid,
                        "wid": wf_id,
                        "ord": step_order,
                        "code": step_code,
                        "name": step_name,
                        "atype": approver_type,
                        "now": now,
                    },
                )


def downgrade() -> None:
    conn = op.get_bind()
    for workflow_code, _, _, _ in WORKFLOWS:
        conn.execute(
            sa.text(
                """
                DELETE FROM foundation.wf_step
                WHERE workflow_id IN (
                    SELECT id FROM foundation.wf_definition WHERE workflow_code = :code
                )
                """
            ),
            {"code": workflow_code},
        )
        conn.execute(
            sa.text("DELETE FROM foundation.wf_definition WHERE workflow_code = :code"),
            {"code": workflow_code},
        )
