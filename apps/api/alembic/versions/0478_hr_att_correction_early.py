"""Attendance early_leave_minutes + hr_attendance_correction table."""

import sys
from collections.abc import Sequence
from pathlib import Path

import sqlalchemy as sa
from alembic import op
from sqlalchemy.dialects import postgresql

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))

from helpers import add_column_if_missing  # noqa: E402

revision: str = "0478_hr_att_correction_early"
down_revision: str | None = "0477_hr_fnf_and_kyc_docs"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    add_column_if_missing(
        "hr_attendance",
        sa.Column("early_leave_minutes", sa.Integer(), nullable=True),
        schema="hr",
    )

    op.create_table(
        "hr_attendance_correction",
        sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True, nullable=False),
        sa.Column("tenant_id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("company_id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("branch_id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("employee_id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("attendance_id", postgresql.UUID(as_uuid=True), nullable=True),
        sa.Column("attendance_date", sa.Date(), nullable=False),
        sa.Column("field_name", sa.String(30), nullable=False),
        sa.Column("old_value", sa.String(100), nullable=True),
        sa.Column("new_value", sa.String(100), nullable=False),
        sa.Column("reason", sa.Text(), nullable=True),
        sa.Column("status", sa.String(30), nullable=False, server_default="draft"),
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
        sa.ForeignKeyConstraint(["attendance_id"], ["hr.hr_attendance.id"], ondelete="SET NULL"),
        sa.CheckConstraint(
            "status IN ('draft','submitted','approved','rejected')",
            name="ck_hr_att_corr_status",
        ),
        sa.CheckConstraint(
            "field_name IN ('check_in','check_out','attendance_status')",
            name="ck_hr_att_corr_field",
        ),
        schema="hr",
    )
    op.create_index("ix_hr_att_corr_emp", "hr_attendance_correction", ["employee_id"], schema="hr")
    op.create_index("ix_hr_att_corr_date", "hr_attendance_correction", ["attendance_date"], schema="hr")
    op.create_index("ix_hr_att_corr_status", "hr_attendance_correction", ["status"], schema="hr")


def downgrade() -> None:
    op.drop_table("hr_attendance_correction", schema="hr")
    op.drop_column("hr_attendance", "early_leave_minutes", schema="hr")
