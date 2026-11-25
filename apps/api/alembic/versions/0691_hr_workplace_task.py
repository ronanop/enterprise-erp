"""ESS workplace tasks — assign, accept, proof, verify."""

from __future__ import annotations

from collections.abc import Sequence

import sqlalchemy as sa
from alembic import op
from sqlalchemy.dialects import postgresql

revision: str = "0691_hr_workplace_task"
down_revision: str | None = "0690_hr_ess_story_likes_mentions"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None

UUID = postgresql.UUID(as_uuid=True)


def _audit_cols() -> list[sa.Column]:
    return [
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.text("now()"), nullable=False),
        sa.Column("created_by", UUID, nullable=True),
        sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.text("now()"), nullable=False),
        sa.Column("updated_by", UUID, nullable=True),
        sa.Column("tenant_id", UUID, sa.ForeignKey("foundation.sec_tenant.id", ondelete="RESTRICT"), nullable=False),
        sa.Column("company_id", UUID, sa.ForeignKey("organization.org_company.id", ondelete="RESTRICT"), nullable=False),
        sa.Column("branch_id", UUID, sa.ForeignKey("organization.org_branch.id", ondelete="RESTRICT"), nullable=False),
        sa.Column("is_deleted", sa.Boolean(), server_default=sa.text("false"), nullable=False),
        sa.Column("deleted_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("deleted_by", UUID, nullable=True),
        sa.Column("version", sa.Integer(), server_default="1", nullable=False),
    ]


def upgrade() -> None:
    op.create_table(
        "hr_workplace_task",
        sa.Column("id", UUID, primary_key=True),
        sa.Column("creator_employee_id", UUID, sa.ForeignKey("master.master_employee.id", ondelete="RESTRICT"), nullable=False),
        sa.Column("title", sa.String(200), nullable=False),
        sa.Column("description", sa.Text(), server_default="", nullable=False),
        sa.Column("deadline", sa.DateTime(timezone=True), nullable=True),
        sa.Column("status", sa.String(30), server_default="open", nullable=False),
        sa.Column("assignee_count", sa.Integer(), server_default="0", nullable=False),
        sa.Column("assignment_mode", sa.String(20), server_default="users", nullable=False),
        sa.Column("department_id", UUID, sa.ForeignKey("organization.org_department.id", ondelete="SET NULL"), nullable=True),
        sa.CheckConstraint("status IN ('open','in_progress','completed','cancelled')", name="ck_hr_workplace_task_status"),
        sa.CheckConstraint("assignment_mode IN ('users','department')", name="ck_hr_workplace_task_assignment_mode"),
        *_audit_cols(),
        schema="hr",
    )
    op.create_index("ix_hr_workplace_task_creator_employee_id", "hr_workplace_task", ["creator_employee_id"], schema="hr")
    op.create_index("ix_hr_workplace_task_status", "hr_workplace_task", ["status"], schema="hr")
    op.create_index("ix_hr_workplace_task_deadline", "hr_workplace_task", ["deadline"], schema="hr")
    op.create_index("ix_hr_workplace_task_department_id", "hr_workplace_task", ["department_id"], schema="hr")

    op.create_table(
        "hr_workplace_task_assignee",
        sa.Column("id", UUID, primary_key=True),
        sa.Column("task_id", UUID, sa.ForeignKey("hr.hr_workplace_task.id", ondelete="CASCADE"), nullable=False),
        sa.Column("employee_id", UUID, sa.ForeignKey("master.master_employee.id", ondelete="RESTRICT"), nullable=False),
        sa.Column("status", sa.String(30), server_default="assigned", nullable=False),
        sa.Column("responded_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("started_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("completed_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("review_note", sa.Text(), server_default="", nullable=False),
        sa.Column("submitted_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("verified_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("verified_by_employee_id", UUID, sa.ForeignKey("master.master_employee.id", ondelete="SET NULL"), nullable=True),
        sa.UniqueConstraint("task_id", "employee_id", name="uk_hr_workplace_task_assignee"),
        sa.CheckConstraint(
            "status IN ('assigned','accepted','declined','started','in_progress','pending_verification','redo_requested','completed')",
            name="ck_hr_workplace_task_assignee_status",
        ),
        *_audit_cols(),
        schema="hr",
    )
    op.create_index("ix_hr_workplace_task_assignee_task_id", "hr_workplace_task_assignee", ["task_id"], schema="hr")
    op.create_index("ix_hr_workplace_task_assignee_employee_id", "hr_workplace_task_assignee", ["employee_id"], schema="hr")

    op.create_table(
        "hr_workplace_task_event",
        sa.Column("id", UUID, primary_key=True),
        sa.Column("task_id", UUID, sa.ForeignKey("hr.hr_workplace_task.id", ondelete="CASCADE"), nullable=False),
        sa.Column("assignee_id", UUID, sa.ForeignKey("hr.hr_workplace_task_assignee.id", ondelete="SET NULL"), nullable=True),
        sa.Column("actor_employee_id", UUID, sa.ForeignKey("master.master_employee.id", ondelete="SET NULL"), nullable=True),
        sa.Column("event_type", sa.String(50), nullable=False),
        sa.Column("label", sa.String(200), nullable=False),
        sa.Column("detail", sa.Text(), server_default="", nullable=False),
        *_audit_cols(),
        schema="hr",
    )
    op.create_index("ix_hr_workplace_task_event_task_id", "hr_workplace_task_event", ["task_id"], schema="hr")

    op.create_table(
        "hr_workplace_task_proof",
        sa.Column("id", UUID, primary_key=True),
        sa.Column("task_id", UUID, sa.ForeignKey("hr.hr_workplace_task.id", ondelete="CASCADE"), nullable=False),
        sa.Column("assignee_id", UUID, sa.ForeignKey("hr.hr_workplace_task_assignee.id", ondelete="CASCADE"), nullable=False),
        sa.Column("storage_uri", sa.String(1000), nullable=False),
        sa.Column("file_name", sa.String(255), nullable=False),
        sa.Column("content_type", sa.String(120), server_default="", nullable=False),
        sa.Column("byte_size", sa.Integer(), server_default="0", nullable=False),
        sa.Column("uploaded_by_employee_id", UUID, sa.ForeignKey("master.master_employee.id", ondelete="RESTRICT"), nullable=False),
        sa.Column("note", sa.Text(), server_default="", nullable=False),
        *_audit_cols(),
        schema="hr",
    )
    op.create_index("ix_hr_workplace_task_proof_task_id", "hr_workplace_task_proof", ["task_id"], schema="hr")
    op.create_index("ix_hr_workplace_task_proof_assignee_id", "hr_workplace_task_proof", ["assignee_id"], schema="hr")


def downgrade() -> None:
    op.drop_table("hr_workplace_task_proof", schema="hr")
    op.drop_table("hr_workplace_task_event", schema="hr")
    op.drop_table("hr_workplace_task_assignee", schema="hr")
    op.drop_table("hr_workplace_task", schema="hr")
