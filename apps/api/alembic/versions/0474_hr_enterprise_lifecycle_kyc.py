"""HR enterprise: lifecycle history, KYC fields, leave dual-approve, masters."""

import sys
from collections.abc import Sequence
from pathlib import Path

import sqlalchemy as sa
from alembic import op
from sqlalchemy.dialects import postgresql

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))

from helpers import add_column_if_missing, create_index_if_missing  # noqa: E402

revision: str = "0474_hr_enterprise_lifecycle_kyc"
down_revision: str | None = "0473_hr_training_rooms_requests"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    # --- Employment lifecycle statuses ---
    op.drop_constraint("ck_hr_empl_status", "hr_employment", schema="hr", type_="check")
    op.create_check_constraint(
        "ck_hr_empl_status",
        "hr_employment",
        "status IN ('draft','onboarding','active','probation','confirmed',"
        "'notice_period','separated','ex_employee','ended','cancelled')",
        schema="hr",
    )
    add_column_if_missing(
        "hr_employment",
        sa.Column("probation_start_date", sa.Date(), nullable=True),
        schema="hr",
    )
    add_column_if_missing(
        "hr_employment",
        sa.Column("lifecycle_source", sa.String(50), nullable=True),
        schema="hr",
    )

    # --- Master employee statuses ---
    op.drop_constraint("ck_master_employee_status", "master_employee", schema="master", type_="check")
    op.create_check_constraint(
        "ck_master_employee_status",
        "master_employee",
        "status IN ('draft','onboarding','active','probation','on_leave',"
        "'notice_period','resigned','terminated','ex_employee')",
        schema="master",
    )

    # --- KYC on employee profile ---
    add_column_if_missing("hr_employee_profile", sa.Column("aadhaar_number", sa.String(12), nullable=True), schema="hr")
    add_column_if_missing("hr_employee_profile", sa.Column("pan_number", sa.String(10), nullable=True), schema="hr")
    add_column_if_missing("hr_employee_profile", sa.Column("uan_number", sa.String(20), nullable=True), schema="hr")
    add_column_if_missing("hr_employee_profile", sa.Column("bank_account_number", sa.String(30), nullable=True), schema="hr")
    add_column_if_missing("hr_employee_profile", sa.Column("bank_ifsc", sa.String(11), nullable=True), schema="hr")
    add_column_if_missing("hr_employee_profile", sa.Column("bank_name", sa.String(100), nullable=True), schema="hr")
    add_column_if_missing("hr_employee_profile", sa.Column("bank_account_holder", sa.String(255), nullable=True), schema="hr")
    create_index_if_missing("ix_hr_profile_aadhaar", "hr_employee_profile", ["aadhaar_number"], schema="hr")
    create_index_if_missing("ix_hr_profile_pan", "hr_employee_profile", ["pan_number"], schema="hr")

    # --- Leave dual approval ---
    op.drop_constraint("ck_hr_lve_status", "hr_leave_request", schema="hr", type_="check")
    op.create_check_constraint(
        "ck_hr_lve_status",
        "hr_leave_request",
        "status IN ('draft','submitted','manager_approved','approved','rejected','cancelled')",
        schema="hr",
    )
    add_column_if_missing(
        "hr_leave_request",
        sa.Column("manager_approver_id", postgresql.UUID(as_uuid=True), nullable=True),
        schema="hr",
    )
    add_column_if_missing(
        "hr_leave_request",
        sa.Column("hr_approver_id", postgresql.UUID(as_uuid=True), nullable=True),
        schema="hr",
    )

    # --- Leave type policy columns ---
    add_column_if_missing(
        "hr_leave_type",
        sa.Column("carry_forward_allowed", sa.Boolean(), nullable=False, server_default=sa.text("false")),
        schema="hr",
    )
    add_column_if_missing(
        "hr_leave_type",
        sa.Column("max_carry_forward_days", sa.Numeric(9, 2), nullable=True),
        schema="hr",
    )
    add_column_if_missing(
        "hr_leave_type",
        sa.Column("encashment_allowed", sa.Boolean(), nullable=False, server_default=sa.text("false")),
        schema="hr",
    )
    add_column_if_missing(
        "hr_leave_type",
        sa.Column("monthly_credit_days", sa.Numeric(9, 2), nullable=True),
        schema="hr",
    )
    add_column_if_missing(
        "hr_leave_type",
        sa.Column("leave_cycle_start_day", sa.SmallInteger(), nullable=False, server_default="1"),
        schema="hr",
    )

    # --- Attendance status expansion ---
    op.drop_constraint("ck_hr_att_day_status", "hr_attendance", schema="hr", type_="check")
    op.create_check_constraint(
        "ck_hr_att_day_status",
        "hr_attendance",
        "attendance_status IN ('present','absent','half_day','work_from_home',"
        "'holiday','late','week_off','on_duty','miss_punch')",
        schema="hr",
    )
    add_column_if_missing("hr_attendance", sa.Column("latitude", sa.Numeric(10, 7), nullable=True), schema="hr")
    add_column_if_missing("hr_attendance", sa.Column("longitude", sa.Numeric(10, 7), nullable=True), schema="hr")
    add_column_if_missing("hr_attendance", sa.Column("late_minutes", sa.Integer(), nullable=True), schema="hr")
    add_column_if_missing("hr_attendance", sa.Column("overtime_minutes", sa.Integer(), nullable=True), schema="hr")

    # --- Lifecycle history ---
    op.create_table(
        "hr_lifecycle_event",
        sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True, nullable=False),
        sa.Column("tenant_id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("company_id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("branch_id", postgresql.UUID(as_uuid=True), nullable=True),
        sa.Column("employee_id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("employment_id", postgresql.UUID(as_uuid=True), nullable=True),
        sa.Column("from_status", sa.String(30), nullable=True),
        sa.Column("to_status", sa.String(30), nullable=False),
        sa.Column("event_type", sa.String(50), nullable=False),
        sa.Column("event_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("notes", sa.Text(), nullable=True),
        sa.Column("meta_json", postgresql.JSONB(), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("created_by", postgresql.UUID(as_uuid=True), nullable=True),
        sa.Column("updated_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("updated_by", postgresql.UUID(as_uuid=True), nullable=True),
        sa.Column("is_deleted", sa.Boolean(), nullable=False, server_default=sa.text("false")),
        sa.Column("deleted_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("deleted_by", postgresql.UUID(as_uuid=True), nullable=True),
        sa.Column("version", sa.Integer(), nullable=False, server_default="1"),
        sa.ForeignKeyConstraint(["employee_id"], ["master.master_employee.id"], ondelete="RESTRICT"),
        sa.ForeignKeyConstraint(["employment_id"], ["hr.hr_employment.id"], ondelete="SET NULL"),
        sa.ForeignKeyConstraint(["company_id"], ["organization.org_company.id"], ondelete="RESTRICT"),
        sa.ForeignKeyConstraint(["branch_id"], ["organization.org_branch.id"], ondelete="RESTRICT"),
        schema="hr",
    )
    op.create_index("ix_hr_lifecycle_employee", "hr_lifecycle_event", ["employee_id"], schema="hr")
    op.create_index("ix_hr_lifecycle_event_at", "hr_lifecycle_event", ["event_at"], schema="hr")

    # --- Job level & grade masters ---
    op.create_table(
        "hr_job_level",
        sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True, nullable=False),
        sa.Column("tenant_id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("company_id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("level_code", sa.String(50), nullable=False),
        sa.Column("level_name", sa.String(255), nullable=False),
        sa.Column("rank_order", sa.Integer(), nullable=False, server_default="0"),
        sa.Column("status", sa.String(30), nullable=False, server_default="active"),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("created_by", postgresql.UUID(as_uuid=True), nullable=True),
        sa.Column("updated_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("updated_by", postgresql.UUID(as_uuid=True), nullable=True),
        sa.Column("is_deleted", sa.Boolean(), nullable=False, server_default=sa.text("false")),
        sa.Column("deleted_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("deleted_by", postgresql.UUID(as_uuid=True), nullable=True),
        sa.Column("version", sa.Integer(), nullable=False, server_default="1"),
        sa.ForeignKeyConstraint(["company_id"], ["organization.org_company.id"], ondelete="RESTRICT"),
        sa.UniqueConstraint("company_id", "level_code", name="uk_hr_job_level_company_code"),
        sa.CheckConstraint("status IN ('active','inactive')", name="ck_hr_job_level_status"),
        schema="hr",
    )
    op.create_table(
        "hr_grade",
        sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True, nullable=False),
        sa.Column("tenant_id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("company_id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("grade_code", sa.String(50), nullable=False),
        sa.Column("grade_name", sa.String(255), nullable=False),
        sa.Column("min_ctc", sa.Numeric(18, 4), nullable=True),
        sa.Column("max_ctc", sa.Numeric(18, 4), nullable=True),
        sa.Column("status", sa.String(30), nullable=False, server_default="active"),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("created_by", postgresql.UUID(as_uuid=True), nullable=True),
        sa.Column("updated_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("updated_by", postgresql.UUID(as_uuid=True), nullable=True),
        sa.Column("is_deleted", sa.Boolean(), nullable=False, server_default=sa.text("false")),
        sa.Column("deleted_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("deleted_by", postgresql.UUID(as_uuid=True), nullable=True),
        sa.Column("version", sa.Integer(), nullable=False, server_default="1"),
        sa.ForeignKeyConstraint(["company_id"], ["organization.org_company.id"], ondelete="RESTRICT"),
        sa.UniqueConstraint("company_id", "grade_code", name="uk_hr_grade_company_code"),
        sa.CheckConstraint("status IN ('active','inactive')", name="ck_hr_grade_status"),
        schema="hr",
    )

    # --- Org location geofence radius ---
    add_column_if_missing(
        "org_location",
        sa.Column("geofence_radius_meters", sa.Integer(), nullable=True),
        schema="organization",
    )


def downgrade() -> None:
    op.drop_column("org_location", "geofence_radius_meters", schema="organization")
    op.drop_table("hr_grade", schema="hr")
    op.drop_table("hr_job_level", schema="hr")
    op.drop_table("hr_lifecycle_event", schema="hr")

    op.drop_column("hr_attendance", "overtime_minutes", schema="hr")
    op.drop_column("hr_attendance", "late_minutes", schema="hr")
    op.drop_column("hr_attendance", "longitude", schema="hr")
    op.drop_column("hr_attendance", "latitude", schema="hr")
    op.drop_constraint("ck_hr_att_day_status", "hr_attendance", schema="hr", type_="check")
    op.create_check_constraint(
        "ck_hr_att_day_status",
        "hr_attendance",
        "attendance_status IN ('present','absent','half_day','work_from_home','holiday')",
        schema="hr",
    )

    for col in (
        "leave_cycle_start_day",
        "monthly_credit_days",
        "encashment_allowed",
        "max_carry_forward_days",
        "carry_forward_allowed",
    ):
        op.drop_column("hr_leave_type", col, schema="hr")

    op.drop_column("hr_leave_request", "hr_approver_id", schema="hr")
    op.drop_column("hr_leave_request", "manager_approver_id", schema="hr")
    op.drop_constraint("ck_hr_lve_status", "hr_leave_request", schema="hr", type_="check")
    op.create_check_constraint(
        "ck_hr_lve_status",
        "hr_leave_request",
        "status IN ('draft','submitted','approved','rejected','cancelled')",
        schema="hr",
    )

    op.drop_index("ix_hr_profile_pan", table_name="hr_employee_profile", schema="hr")
    op.drop_index("ix_hr_profile_aadhaar", table_name="hr_employee_profile", schema="hr")
    for col in (
        "bank_account_holder",
        "bank_name",
        "bank_ifsc",
        "bank_account_number",
        "uan_number",
        "pan_number",
        "aadhaar_number",
    ):
        op.drop_column("hr_employee_profile", col, schema="hr")

    op.drop_column("hr_employment", "lifecycle_source", schema="hr")
    op.drop_column("hr_employment", "probation_start_date", schema="hr")
    op.drop_constraint("ck_hr_empl_status", "hr_employment", schema="hr", type_="check")
    op.create_check_constraint(
        "ck_hr_empl_status",
        "hr_employment",
        "status IN ('draft','active','probation','confirmed','ended','cancelled')",
        schema="hr",
    )

    op.drop_constraint("ck_master_employee_status", "master_employee", schema="master", type_="check")
    op.create_check_constraint(
        "ck_master_employee_status",
        "master_employee",
        "status IN ('draft','active','on_leave','resigned','terminated')",
        schema="master",
    )
