"""Drop On Duty ESS check-in GPS columns."""

from typing import Sequence, Union

import sqlalchemy as sa
from alembic import op

revision: str = "0676_drop_hr_on_duty_check_in_geo"
down_revision: Union[str, None] = "0675_hr_on_duty_check_in_geo"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.drop_column("hr_on_duty_request", "check_in_location_label", schema="hr")
    op.drop_column("hr_on_duty_request", "check_in_longitude", schema="hr")
    op.drop_column("hr_on_duty_request", "check_in_latitude", schema="hr")
    op.drop_column("hr_on_duty_request", "check_in_at", schema="hr")


def downgrade() -> None:
    op.add_column(
        "hr_on_duty_request",
        sa.Column("check_in_at", sa.DateTime(timezone=True), nullable=True),
        schema="hr",
    )
    op.add_column(
        "hr_on_duty_request",
        sa.Column("check_in_latitude", sa.Numeric(10, 7), nullable=True),
        schema="hr",
    )
    op.add_column(
        "hr_on_duty_request",
        sa.Column("check_in_longitude", sa.Numeric(10, 7), nullable=True),
        schema="hr",
    )
    op.add_column(
        "hr_on_duty_request",
        sa.Column("check_in_location_label", sa.String(length=255), nullable=True),
        schema="hr",
    )
