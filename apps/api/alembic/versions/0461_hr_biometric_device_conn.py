"""Add biometric device connection fields (model, ip, port)."""

from collections.abc import Sequence

import sqlalchemy as sa
from alembic import op

revision: str = "0461_hr_bio_device_conn"
down_revision: str | None = "0460_hr_shift_swap_rot"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    op.add_column(
        "hr_biometric_device",
        sa.Column("device_model", sa.String(80), nullable=False, server_default="fingerprint_k40_timelabs"),
        schema="hr",
    )
    op.add_column(
        "hr_biometric_device",
        sa.Column("ip_address", sa.String(64), nullable=True),
        schema="hr",
    )
    op.add_column(
        "hr_biometric_device",
        sa.Column("port", sa.Integer(), nullable=True),
        schema="hr",
    )
    op.create_check_constraint(
        "ck_hr_bio_device_model",
        "hr_biometric_device",
        "device_model IN ('fingerprint_k40_timelabs')",
        schema="hr",
    )


def downgrade() -> None:
    op.drop_constraint("ck_hr_bio_device_model", "hr_biometric_device", schema="hr", type_="check")
    op.drop_column("hr_biometric_device", "port", schema="hr")
    op.drop_column("hr_biometric_device", "ip_address", schema="hr")
    op.drop_column("hr_biometric_device", "device_model", schema="hr")
