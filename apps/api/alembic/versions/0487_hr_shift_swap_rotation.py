"""V2 finish P15: shift swap + rotation tables."""

from collections.abc import Sequence

import sqlalchemy as sa
from alembic import op
from sqlalchemy.dialects import postgresql

revision: str = "0487_hr_shift_swap_rot"
down_revision: str | None = "0486_hr_v2_finish"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    op.create_table(
        "hr_shift_rotation",
        sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True, nullable=False),
        sa.Column("tenant_id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("company_id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("branch_id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("rotation_code", sa.String(50), nullable=False),
        sa.Column("rotation_name", sa.String(255), nullable=False),
        sa.Column("cycle", sa.String(30), nullable=False, server_default="weekly"),
        sa.Column("sequence_json", sa.Text(), nullable=False, server_default="[]"),
        sa.Column("employee_ids_json", sa.Text(), nullable=False, server_default="[]"),
        sa.Column("effective_from", sa.Date(), nullable=False),
        sa.Column("status", sa.String(30), nullable=False, server_default="active"),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False, server_default=sa.text("now()")),
        sa.Column("updated_at", sa.DateTime(timezone=True), nullable=False, server_default=sa.text("now()")),
        sa.Column("created_by", postgresql.UUID(as_uuid=True), nullable=True),
        sa.Column("updated_by", postgresql.UUID(as_uuid=True), nullable=True),
        sa.Column("is_deleted", sa.Boolean(), nullable=False, server_default=sa.text("false")),
        sa.Column("deleted_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("deleted_by", postgresql.UUID(as_uuid=True), nullable=True),
        sa.Column("version", sa.Integer(), nullable=False, server_default="1"),
        sa.UniqueConstraint("company_id", "rotation_code", name="uk_hr_shift_rotation_code"),
        sa.CheckConstraint("cycle IN ('weekly','biweekly','monthly')", name="ck_hr_shift_rot_cycle"),
        sa.CheckConstraint("status IN ('active','inactive')", name="ck_hr_shift_rot_status"),
        schema="hr",
    )

    op.create_table(
        "hr_shift_swap_request",
        sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True, nullable=False),
        sa.Column("tenant_id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("company_id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("branch_id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("employee_id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("swap_with_employee_id", postgresql.UUID(as_uuid=True), nullable=True),
        sa.Column("current_shift_id", postgresql.UUID(as_uuid=True), nullable=True),
        sa.Column("requested_shift_id", postgresql.UUID(as_uuid=True), nullable=True),
        sa.Column("swap_date", sa.Date(), nullable=False),
        sa.Column("reason", sa.Text(), nullable=True),
        sa.Column("status", sa.String(30), nullable=False, server_default="draft"),
        sa.Column("manager_approver_id", postgresql.UUID(as_uuid=True), nullable=True),
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
        sa.ForeignKeyConstraint(["swap_with_employee_id"], ["master.master_employee.id"], ondelete="SET NULL"),
        sa.ForeignKeyConstraint(["current_shift_id"], ["hr.hr_shift.id"], ondelete="SET NULL"),
        sa.ForeignKeyConstraint(["requested_shift_id"], ["hr.hr_shift.id"], ondelete="SET NULL"),
        sa.CheckConstraint(
            "status IN ('draft','submitted','manager_approved','approved','rejected','cancelled')",
            name="ck_hr_shift_swap_status",
        ),
        schema="hr",
    )
    op.create_index("ix_hr_shift_swap_emp", "hr_shift_swap_request", ["employee_id"], schema="hr")
    op.create_index("ix_hr_shift_swap_date", "hr_shift_swap_request", ["swap_date"], schema="hr")


def downgrade() -> None:
    op.drop_table("hr_shift_swap_request", schema="hr")
    op.drop_table("hr_shift_rotation", schema="hr")
