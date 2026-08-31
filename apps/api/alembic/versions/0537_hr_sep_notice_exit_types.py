"""Notice period fields and extra exit types on hr_separation."""

from collections.abc import Sequence

import sqlalchemy as sa
from alembic import op

revision: str = "0537_hr_sep_notice_exit_types"
down_revision: str | None = "0536_hr_digital_onboarding"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    op.drop_constraint("ck_hr_sep_type", "hr_separation", schema="hr", type_="check")
    op.create_check_constraint(
        "ck_hr_sep_type",
        "hr_separation",
        "separation_type IN ('resignation','termination','retirement','death','other')",
        schema="hr",
    )
    op.add_column(
        "hr_separation",
        sa.Column("resignation_date", sa.Date(), nullable=True),
        schema="hr",
    )
    op.add_column(
        "hr_separation",
        sa.Column("notice_period_days", sa.SmallInteger(), nullable=True),
        schema="hr",
    )
    op.add_column(
        "hr_separation",
        sa.Column("notice_start_date", sa.Date(), nullable=True),
        schema="hr",
    )
    op.add_column(
        "hr_separation",
        sa.Column("expected_exit_date", sa.Date(), nullable=True),
        schema="hr",
    )
    op.add_column(
        "hr_separation",
        sa.Column(
            "notice_status",
            sa.String(30),
            nullable=False,
            server_default="pending",
        ),
        schema="hr",
    )
    op.add_column(
        "hr_separation",
        sa.Column(
            "initiated_by",
            sa.String(20),
            nullable=False,
            server_default="hr",
        ),
        schema="hr",
    )
    op.create_index(
        "ix_hr_hr_separation_notice_status",
        "hr_separation",
        ["notice_status"],
        schema="hr",
    )
    op.create_check_constraint(
        "ck_hr_sep_notice_status",
        "hr_separation",
        "notice_status IN ("
        "'pending','on_notice','served','not_served','direct_exit','not_applicable'"
        ")",
        schema="hr",
    )
    op.create_check_constraint(
        "ck_hr_sep_initiated_by",
        "hr_separation",
        "initiated_by IN ('employee','hr')",
        schema="hr",
    )
    op.execute(
        """
        UPDATE hr.hr_separation
        SET expected_exit_date = COALESCE(expected_exit_date, requested_last_working_date),
            resignation_date = COALESCE(resignation_date, created_at::date),
            notice_status = CASE
                WHEN separation_type IN ('termination') THEN 'not_applicable'
                ELSE notice_status
            END
        """
    )


def downgrade() -> None:
    op.execute(
        """
        UPDATE hr.hr_separation
        SET separation_type = 'other'
        WHERE separation_type IN ('death', 'other')
        """
    )
    op.execute(
        """
        UPDATE hr.hr_separation
        SET separation_type = 'termination'
        WHERE separation_type = 'other'
        """
    )
    op.drop_constraint("ck_hr_sep_initiated_by", "hr_separation", schema="hr", type_="check")
    op.drop_constraint("ck_hr_sep_notice_status", "hr_separation", schema="hr", type_="check")
    op.drop_index("ix_hr_hr_separation_notice_status", table_name="hr_separation", schema="hr")
    op.drop_column("hr_separation", "initiated_by", schema="hr")
    op.drop_column("hr_separation", "notice_status", schema="hr")
    op.drop_column("hr_separation", "expected_exit_date", schema="hr")
    op.drop_column("hr_separation", "notice_start_date", schema="hr")
    op.drop_column("hr_separation", "notice_period_days", schema="hr")
    op.drop_column("hr_separation", "resignation_date", schema="hr")
    op.drop_constraint("ck_hr_sep_type", "hr_separation", schema="hr", type_="check")
    op.create_check_constraint(
        "ck_hr_sep_type",
        "hr_separation",
        "separation_type IN ('resignation','termination','retirement')",
        schema="hr",
    )
