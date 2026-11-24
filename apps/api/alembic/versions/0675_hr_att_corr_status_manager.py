"""Widen hr_attendance_correction status check for manager_approved + cancelled."""

from collections.abc import Sequence

from alembic import op

revision: str = "0675_hr_att_corr_status_manager"
down_revision: str | Sequence[str] | None = "0674_hr_workplace_feed_media"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    op.drop_constraint(
        "ck_hr_att_corr_status",
        "hr_attendance_correction",
        schema="hr",
        type_="check",
    )
    op.create_check_constraint(
        "ck_hr_att_corr_status",
        "hr_attendance_correction",
        "status IN ('draft','submitted','manager_approved','approved','rejected','cancelled')",
        schema="hr",
    )


def downgrade() -> None:
    op.execute(
        """
        UPDATE hr.hr_attendance_correction
        SET status = 'submitted'
        WHERE status IN ('manager_approved', 'cancelled')
        """
    )
    op.drop_constraint(
        "ck_hr_att_corr_status",
        "hr_attendance_correction",
        schema="hr",
        type_="check",
    )
    op.create_check_constraint(
        "ck_hr_att_corr_status",
        "hr_attendance_correction",
        "status IN ('draft','submitted','approved','rejected')",
        schema="hr",
    )
