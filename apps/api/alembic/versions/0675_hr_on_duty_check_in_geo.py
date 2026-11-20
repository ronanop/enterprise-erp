"""Add On Duty ESS check-in GPS columns."""

from collections.abc import Sequence

import sqlalchemy as sa
from alembic import op

from helpers import add_column_if_missing

revision: str = "0675_hr_on_duty_check_in_geo"
down_revision: str | Sequence[str] | None = "0674_hr_profile_update_request"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    add_column_if_missing(
        "hr_on_duty_request",
        sa.Column("check_in_at", sa.DateTime(timezone=True), nullable=True),
        schema="hr",
    )
    add_column_if_missing(
        "hr_on_duty_request",
        sa.Column("check_in_latitude", sa.Numeric(10, 7), nullable=True),
        schema="hr",
    )
    add_column_if_missing(
        "hr_on_duty_request",
        sa.Column("check_in_longitude", sa.Numeric(10, 7), nullable=True),
        schema="hr",
    )
    add_column_if_missing(
        "hr_on_duty_request",
        sa.Column("check_in_location_label", sa.String(length=255), nullable=True),
        schema="hr",
    )


def downgrade() -> None:
    op.drop_column("hr_on_duty_request", "check_in_location_label", schema="hr")
    op.drop_column("hr_on_duty_request", "check_in_longitude", schema="hr")
    op.drop_column("hr_on_duty_request", "check_in_latitude", schema="hr")
    op.drop_column("hr_on_duty_request", "check_in_at", schema="hr")
