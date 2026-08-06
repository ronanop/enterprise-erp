"""Add biometric device connection fields (model, ip, port)."""

import sys
from collections.abc import Sequence
from pathlib import Path

import sqlalchemy as sa
from alembic import op

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))

from helpers import add_column_if_missing  # noqa: E402

revision: str = "0488_hr_bio_device_conn"
down_revision: str | None = "0487_hr_shift_swap_rot"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    add_column_if_missing(
        "hr_biometric_device",
        sa.Column("device_model", sa.String(80), nullable=False, server_default="fingerprint_k40_timelabs"),
        schema="hr",
    )
    add_column_if_missing(
        "hr_biometric_device",
        sa.Column("ip_address", sa.String(64), nullable=True),
        schema="hr",
    )
    add_column_if_missing(
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
