"""Create hr_leave_adjustment and sandwich_rule_enabled on leave type."""

from collections.abc import Sequence

import sqlalchemy as sa
from alembic import op
from sqlalchemy.dialects import postgresql

revision: str = "0449_hr_leave_adjustment"
down_revision: str | None = "0448_hr_roster_and_ess"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    op.add_column(
        "hr_leave_type",
        sa.Column(
            "sandwich_rule_enabled",
            sa.Boolean(),
            nullable=False,
            server_default=sa.text("false"),
        ),
        schema="hr",
    )

    op.create_table(
        "hr_leave_adjustment",
        sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True, nullable=False),
        sa.Column("tenant_id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("company_id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("branch_id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("employee_id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("leave_type_id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("adjustment_month", sa.Date(), nullable=False),
        sa.Column("days_delta", sa.Numeric(9, 2), nullable=False),
        sa.Column("reason", sa.Text(), nullable=True),
        sa.Column("status", sa.String(30), nullable=False, server_default="draft"),
        sa.Column("approved_by", postgresql.UUID(as_uuid=True), nullable=True),
        sa.Column("decided_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("created_by", postgresql.UUID(as_uuid=True), nullable=True),
        sa.Column("updated_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("updated_by", postgresql.UUID(as_uuid=True), nullable=True),
        sa.Column("is_deleted", sa.Boolean(), nullable=False, server_default=sa.text("false")),
        sa.Column("deleted_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("deleted_by", postgresql.UUID(as_uuid=True), nullable=True),
        sa.Column("version", sa.Integer(), nullable=False, server_default="1"),
        sa.ForeignKeyConstraint(
            ["employee_id"], ["master.master_employee.id"], ondelete="RESTRICT"
        ),
        sa.ForeignKeyConstraint(
            ["leave_type_id"], ["hr.hr_leave_type.id"], ondelete="RESTRICT"
        ),
        sa.ForeignKeyConstraint(
            ["branch_id"], ["organization.org_branch.id"], ondelete="RESTRICT"
        ),
        sa.CheckConstraint(
            "status IN ('draft','submitted','approved','rejected')",
            name="ck_hr_leave_adj_status",
        ),
        schema="hr",
    )
    op.create_index(
        "ix_hr_leave_adj_branch", "hr_leave_adjustment", ["branch_id"], schema="hr"
    )
    op.create_index(
        "ix_hr_leave_adj_employee", "hr_leave_adjustment", ["employee_id"], schema="hr"
    )
    op.create_index(
        "ix_hr_leave_adj_leave_type", "hr_leave_adjustment", ["leave_type_id"], schema="hr"
    )
    op.create_index(
        "ix_hr_leave_adj_month", "hr_leave_adjustment", ["adjustment_month"], schema="hr"
    )
    op.create_index(
        "ix_hr_leave_adj_status", "hr_leave_adjustment", ["status"], schema="hr"
    )
    op.create_index(
        "ix_hr_leave_adj_company", "hr_leave_adjustment", ["company_id"], schema="hr"
    )
    op.create_index(
        "ix_hr_leave_adj_tenant", "hr_leave_adjustment", ["tenant_id"], schema="hr"
    )


def downgrade() -> None:
    op.drop_table("hr_leave_adjustment", schema="hr")
    op.drop_column("hr_leave_type", "sandwich_rule_enabled", schema="hr")
