"""Seed document workflow definitions per ERD_18."""

from collections.abc import Sequence
from datetime import datetime, timezone
from uuid import uuid4

import sqlalchemy as sa
from alembic import op

revision: str = "0332_seed_document_workflows"
down_revision: str | None = "0331_seed_document_permissions"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None

WORKFLOWS: list[tuple[str, str, str, list[tuple[int, str, str, str]]]] = [
    (
        "DOC_DOCUMENT_APPROVAL",
        "Document Approval",
        "doc_document",
        [
            (1, "DOCUMENT_EDITOR", "Editor Submit", "role"),
            (2, "DOCUMENT_REVIEWER", "Document Reviewer Approval", "role"),
            (3, "DOCUMENT_MANAGER", "Document Manager Approval", "role"),
        ],
    ),
    (
        "DOC_DOCUMENT_PUBLISH",
        "Document Publish",
        "doc_document",
        [
            (1, "DOCUMENT_EDITOR", "Author Submit", "role"),
            (2, "DOCUMENT_REVIEWER", "Document Reviewer Approval", "role"),
            (3, "DOCUMENT_MANAGER", "Document Manager Publish", "role"),
        ],
    ),
    (
        "DOC_DOCUMENT_CHECKOUT",
        "Document Checkout",
        "doc_document_checkout",
        [
            (1, "DOCUMENT_EDITOR", "Editor Submit", "role"),
            (2, "DOCUMENT_MANAGER", "Document Manager Approval", "role"),
        ],
    ),
    (
        "DOC_DOCUMENT_ARCHIVE",
        "Document Archive",
        "doc_archive",
        [
            (1, "DOCUMENT_MANAGER", "Records Owner Submit", "role"),
            (2, "DOCUMENT_MANAGER", "Document Manager Approval", "role"),
            (3, "DOCUMENT_ADMIN", "Document Admin Approval", "role"),
        ],
    ),
    (
        "DOC_RETENTION_APPROVAL",
        "Document Retention Approval",
        "doc_retention_policy",
        [
            (1, "DOCUMENT_MANAGER", "Document Manager Submit", "role"),
            (2, "DOCUMENT_ADMIN", "Document Admin Approval", "role"),
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
                        VALUES (:id, :tid, :code, :name, 'document', :doc, 1, true, :now, :now)
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
