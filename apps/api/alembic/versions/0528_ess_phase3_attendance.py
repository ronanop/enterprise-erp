"""ESS Phase 3: WFH requests, punch selfie hashes, mobile punch policy flags."""

from __future__ import annotations

from collections.abc import Sequence

import sqlalchemy as sa
from alembic import op
from sqlalchemy.dialects import postgresql

revision: str = "0528_ess_phase3_attendance"
down_revision: str | None = "0527_hr_leave_accrual_period"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    op.add_column(
        "hr_attendance_rule",
        sa.Column(
            "ess_selfie_required",
            sa.Boolean(),
            nullable=False,
            server_default=sa.false(),
        ),
        schema="hr",
    )
    op.add_column(
        "hr_attendance_rule",
        sa.Column(
            "ess_face_at_punch_required",
            sa.Boolean(),
            nullable=False,
            server_default=sa.false(),
        ),
        schema="hr",
    )
    op.add_column(
        "hr_attendance",
        sa.Column("check_in_selfie_hash", sa.String(32), nullable=True),
        schema="hr",
    )
    op.add_column(
        "hr_attendance",
        sa.Column("check_out_selfie_hash", sa.String(32), nullable=True),
        schema="hr",
    )

    op.create_table(
        "hr_wfh_request",
        sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True, nullable=False),
        sa.Column("tenant_id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("company_id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("branch_id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("employee_id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("wfh_date", sa.Date(), nullable=False),
        sa.Column("end_date", sa.Date(), nullable=True),
        sa.Column("portion", sa.String(20), nullable=False, server_default="full_day"),
        sa.Column("reason", sa.Text(), nullable=True),
        sa.Column("status", sa.String(30), nullable=False, server_default="draft"),
        sa.Column("manager_approver_id", postgresql.UUID(as_uuid=True), nullable=True),
        sa.Column("approved_by", postgresql.UUID(as_uuid=True), nullable=True),
        sa.Column("decided_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False, server_default=sa.text("now()")),
        sa.Column("updated_at", sa.DateTime(timezone=True), nullable=False, server_default=sa.text("now()")),
        sa.Column("created_by", postgresql.UUID(as_uuid=True), nullable=True),
        sa.Column("updated_by", postgresql.UUID(as_uuid=True), nullable=True),
        sa.Column("is_deleted", sa.Boolean(), nullable=False, server_default=sa.text("false")),
        sa.Column("deleted_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("deleted_by", postgresql.UUID(as_uuid=True), nullable=True),
        sa.Column("version", sa.Integer(), nullable=False, server_default="1"),
        sa.ForeignKeyConstraint(["employee_id"], ["master.master_employee.id"], ondelete="RESTRICT"),
        sa.CheckConstraint(
            "status IN ('draft','submitted','manager_approved','approved','rejected','cancelled')",
            name="ck_hr_wfh_status",
        ),
        sa.CheckConstraint(
            "portion IN ('first_half','second_half','full_day')",
            name="ck_hr_wfh_portion",
        ),
        schema="hr",
    )
    op.create_index("ix_hr_wfh_emp", "hr_wfh_request", ["employee_id"], schema="hr")
    op.create_index("ix_hr_wfh_date", "hr_wfh_request", ["wfh_date"], schema="hr")
    op.create_index("ix_hr_wfh_status", "hr_wfh_request", ["status"], schema="hr")


def downgrade() -> None:
    op.drop_index("ix_hr_wfh_status", table_name="hr_wfh_request", schema="hr")
    op.drop_index("ix_hr_wfh_date", table_name="hr_wfh_request", schema="hr")
    op.drop_index("ix_hr_wfh_emp", table_name="hr_wfh_request", schema="hr")
    op.drop_table("hr_wfh_request", schema="hr")
    op.drop_column("hr_attendance", "check_out_selfie_hash", schema="hr")
    op.drop_column("hr_attendance", "check_in_selfie_hash", schema="hr")
    op.drop_column("hr_attendance_rule", "ess_face_at_punch_required", schema="hr")
    op.drop_column("hr_attendance_rule", "ess_selfie_required", schema="hr")
