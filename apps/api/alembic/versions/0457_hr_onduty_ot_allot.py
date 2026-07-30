"""On-duty requests + OT/overday allotment + Comp Off hour thresholds."""

from collections.abc import Sequence

import sqlalchemy as sa
from alembic import op
from sqlalchemy.dialects import postgresql

revision: str = "0457_hr_onduty_ot_allot"
down_revision: str | None = "0456_hr_payroll_eligible"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    op.add_column(
        "hr_attendance_rule",
        sa.Column(
            "compoff_half_day_hours",
            sa.Numeric(5, 2),
            nullable=False,
            server_default="4.00",
        ),
        schema="hr",
    )
    op.add_column(
        "hr_attendance_rule",
        sa.Column(
            "compoff_full_day_hours",
            sa.Numeric(5, 2),
            nullable=False,
            server_default="8.00",
        ),
        schema="hr",
    )
    op.add_column(
        "hr_attendance_rule",
        sa.Column(
            "compoff_auto_credit",
            sa.Boolean(),
            nullable=False,
            server_default=sa.text("true"),
        ),
        schema="hr",
    )

    op.create_table(
        "hr_on_duty_request",
        sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True, nullable=False),
        sa.Column("tenant_id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("company_id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("branch_id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("employee_id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("duty_date", sa.Date(), nullable=False),
        sa.Column("end_date", sa.Date(), nullable=True),
        sa.Column("portion", sa.String(20), nullable=False, server_default="full_day"),
        sa.Column("duty_location", sa.String(255), nullable=True),
        sa.Column("purpose", sa.Text(), nullable=True),
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
        sa.CheckConstraint(
            "status IN ('draft','submitted','approved','rejected','cancelled')",
            name="ck_hr_onduty_status",
        ),
        sa.CheckConstraint(
            "portion IN ('first_half','second_half','full_day')",
            name="ck_hr_onduty_portion",
        ),
        schema="hr",
    )
    op.create_index("ix_hr_onduty_emp", "hr_on_duty_request", ["employee_id"], schema="hr")
    op.create_index("ix_hr_onduty_date", "hr_on_duty_request", ["duty_date"], schema="hr")
    op.create_index("ix_hr_onduty_status", "hr_on_duty_request", ["status"], schema="hr")

    op.create_table(
        "hr_ot_allotment",
        sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True, nullable=False),
        sa.Column("tenant_id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("company_id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("branch_id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("employee_id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("allotment_date", sa.Date(), nullable=False),
        sa.Column("allotment_type", sa.String(20), nullable=False, server_default="overtime"),
        sa.Column("hours", sa.Numeric(6, 2), nullable=False),
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
        sa.CheckConstraint(
            "status IN ('draft','submitted','approved','rejected','cancelled')",
            name="ck_hr_ot_allot_status",
        ),
        sa.CheckConstraint(
            "allotment_type IN ('overtime','overday')",
            name="ck_hr_ot_allot_type",
        ),
        schema="hr",
    )
    op.create_index("ix_hr_ot_allot_emp", "hr_ot_allotment", ["employee_id"], schema="hr")
    op.create_index("ix_hr_ot_allot_date", "hr_ot_allotment", ["allotment_date"], schema="hr")
    op.create_index("ix_hr_ot_allot_status", "hr_ot_allotment", ["status"], schema="hr")


def downgrade() -> None:
    op.drop_table("hr_ot_allotment", schema="hr")
    op.drop_table("hr_on_duty_request", schema="hr")
    op.drop_column("hr_attendance_rule", "compoff_auto_credit", schema="hr")
    op.drop_column("hr_attendance_rule", "compoff_full_day_hours", schema="hr")
    op.drop_column("hr_attendance_rule", "compoff_half_day_hours", schema="hr")
