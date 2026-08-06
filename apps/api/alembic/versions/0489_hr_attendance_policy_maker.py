"""Attendance policy maker: arrival windows + biometric punch mode."""

import sys
from collections.abc import Sequence
from pathlib import Path

import sqlalchemy as sa
from alembic import op
from sqlalchemy.dialects import postgresql

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))

from helpers import add_column_if_missing  # noqa: E402

revision: str = "0489_hr_att_policy_maker"
down_revision: str | None = "0488_hr_bio_device_conn"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    add_column_if_missing(
        "hr_attendance_rule",
        sa.Column(
            "punch_mode",
            sa.String(40),
            nullable=False,
            server_default="first_in_last_out",
        ),
        schema="hr",
    )
    add_column_if_missing(
        "hr_attendance_rule",
        sa.Column(
            "arrival_policy_enabled",
            sa.Boolean(),
            nullable=False,
            server_default=sa.text("false"),
        ),
        schema="hr",
    )
    add_column_if_missing(
        "hr_attendance_rule",
        sa.Column(
            "applies_to_all_shifts",
            sa.Boolean(),
            nullable=False,
            server_default=sa.text("true"),
        ),
        schema="hr",
    )
    add_column_if_missing(
        "hr_attendance_rule",
        sa.Column("arrival_window_start", sa.Time(), nullable=True),
        schema="hr",
    )
    add_column_if_missing(
        "hr_attendance_rule",
        sa.Column("arrival_ok_until", sa.Time(), nullable=True),
        schema="hr",
    )
    add_column_if_missing(
        "hr_attendance_rule",
        sa.Column(
            "arrival_after_status",
            sa.String(30),
            nullable=False,
            server_default="half_day",
        ),
        schema="hr",
    )
    add_column_if_missing(
        "hr_attendance_rule",
        sa.Column("shift_windows_json", postgresql.JSONB(), nullable=True),
        schema="hr",
    )
    op.create_check_constraint(
        "ck_hr_att_rule_punch_mode",
        "hr_attendance_rule",
        "punch_mode IN ('first_in_last_out','every_punch')",
        schema="hr",
    )
    op.create_check_constraint(
        "ck_hr_att_rule_arrival_after",
        "hr_attendance_rule",
        "arrival_after_status IN ('half_day','absent','late')",
        schema="hr",
    )

def downgrade() -> None:
    op.drop_constraint("ck_hr_att_rule_arrival_after", "hr_attendance_rule", schema="hr", type_="check")
    op.drop_constraint("ck_hr_att_rule_punch_mode", "hr_attendance_rule", schema="hr", type_="check")
    op.drop_column("hr_attendance_rule", "shift_windows_json", schema="hr")
    op.drop_column("hr_attendance_rule", "arrival_after_status", schema="hr")
    op.drop_column("hr_attendance_rule", "arrival_ok_until", schema="hr")
    op.drop_column("hr_attendance_rule", "arrival_window_start", schema="hr")
    op.drop_column("hr_attendance_rule", "applies_to_all_shifts", schema="hr")
    op.drop_column("hr_attendance_rule", "arrival_policy_enabled", schema="hr")
    op.drop_column("hr_attendance_rule", "punch_mode", schema="hr")
