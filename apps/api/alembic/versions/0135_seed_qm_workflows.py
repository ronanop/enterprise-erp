"""Seed quality workflow definitions per ERD_09."""

from collections.abc import Sequence
from datetime import datetime, timezone
from uuid import uuid4

import sqlalchemy as sa
from alembic import op

revision: str = "0135_seed_qm_workflows"
down_revision: str | None = "0134_seed_qm_permissions"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None

WORKFLOWS: list[tuple[str, str, str, list[tuple[int, str, str, str]]]] = [
    (
        "QM_INCOMING_DISPOSITION",
        "Incoming Inspection Disposition",
        "qm_incoming_inspection",
        [
            (1, "QUALITY_INSPECTOR", "Inspector Review", "role"),
            (2, "QUALITY_MANAGER", "Quality Manager Approval", "role"),
        ],
    ),
    (
        "QM_FINAL_RELEASE",
        "Final Inspection Release",
        "qm_final_inspection",
        [
            (1, "QUALITY_INSPECTOR", "Inspector Submit", "role"),
            (2, "QUALITY_MANAGER", "Quality Manager Release", "role"),
        ],
    ),
    (
        "QM_NCR_APPROVAL",
        "NCR Approval",
        "qm_ncr",
        [
            (1, "QUALITY_INSPECTOR", "Inspector Submit", "role"),
            (2, "QUALITY_MANAGER", "Quality Manager Approval", "role"),
        ],
    ),
    (
        "QM_CAPA_APPROVAL",
        "CAPA Approval",
        "qm_capa",
        [
            (1, "QUALITY_ENGINEER", "Quality Engineer Review", "role"),
            (2, "QUALITY_MANAGER", "Quality Manager Approval", "role"),
        ],
    ),
    (
        "QM_AUDIT_CLOSURE",
        "Quality Audit Closure",
        "qm_quality_audit",
        [
            (1, "QUALITY_AUDITOR", "Auditor Complete", "role"),
            (2, "QUALITY_MANAGER", "Quality Head Closure", "role"),
        ],
    ),
    (
        "QM_COMPLAINT_CLOSURE",
        "Customer Complaint Closure",
        "qm_customer_complaint",
        [
            (1, "QUALITY_ENGINEER", "Quality Investigation", "role"),
            (2, "QUALITY_MANAGER", "Quality Manager Closure", "role"),
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
                        VALUES (:id, :tid, :code, :name, 'quality', :doc, 1, true, :now, :now)
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
                        WHERE workflow_id = :wf AND step_order = :ord
                        """
                    ),
                    {"wf": wf_id, "ord": step_order},
                ).first()
                if step_exists:
                    continue
                conn.execute(
                    sa.text(
                        """
                        INSERT INTO foundation.wf_step
                        (id, tenant_id, workflow_id, step_order, step_code, step_name,
                         approver_type, is_parallel, created_at, updated_at)
                        VALUES (:id, :tid, :wf, :ord, :scode, :sname, :atype, false, :now, :now)
                        """
                    ),
                    {
                        "id": str(uuid4()),
                        "tid": tid,
                        "wf": wf_id,
                        "ord": step_order,
                        "scode": step_code,
                        "sname": step_name,
                        "atype": approver_type,
                        "now": now,
                    },
                )


def downgrade() -> None:
    conn = op.get_bind()
    codes = [wf[0] for wf in WORKFLOWS]
    for code in codes:
        conn.execute(
            sa.text(
                """
                DELETE FROM foundation.wf_step
                WHERE workflow_id IN (
                    SELECT id FROM foundation.wf_definition WHERE workflow_code = :code
                )
                """
            ),
            {"code": code},
        )
        conn.execute(
            sa.text("DELETE FROM foundation.wf_definition WHERE workflow_code = :code"),
            {"code": code},
        )
