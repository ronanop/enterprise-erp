"""Add period_days / shift / day summary to payroll run lines (Phase 2)."""

import sys
from collections.abc import Sequence
from pathlib import Path

import sqlalchemy as sa
from alembic import op
from sqlalchemy.dialects import postgresql

sys.path.insert(0, str(Path(__file__).resolve().parents[2] / "src"))

revision: str = "0531_pay_run_line_period_days"
down_revision: str | None = "0530_pay_payroll_policy"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    op.add_column(
        "pay_payroll_run_line",
        sa.Column("period_days", sa.Numeric(9, 2), nullable=False, server_default="0"),
        schema="payroll",
    )
    op.add_column(
        "pay_payroll_run_line",
        sa.Column(
            "primary_shift_id",
            postgresql.UUID(as_uuid=True),
            nullable=True,
        ),
        schema="payroll",
    )
    op.add_column(
        "pay_payroll_run_line",
        sa.Column("day_summary_json", postgresql.JSONB, nullable=True),
        schema="payroll",
    )
    op.create_foreign_key(
        "fk_pay_run_line_shift",
        "pay_payroll_run_line",
        "hr_shift",
        ["primary_shift_id"],
        ["id"],
        source_schema="payroll",
        referent_schema="hr",
        ondelete="SET NULL",
    )


def downgrade() -> None:
    op.drop_constraint("fk_pay_run_line_shift", "pay_payroll_run_line", schema="payroll", type_="foreignkey")
    op.drop_column("pay_payroll_run_line", "day_summary_json", schema="payroll")
    op.drop_column("pay_payroll_run_line", "primary_shift_id", schema="payroll")
    op.drop_column("pay_payroll_run_line", "period_days", schema="payroll")
