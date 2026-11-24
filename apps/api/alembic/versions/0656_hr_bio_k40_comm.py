"""Store K40 LAN connection fields: subnet, gateway, comm password."""

from __future__ import annotations

import sys
from collections.abc import Sequence
from pathlib import Path

import sqlalchemy as sa
from alembic import op

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))

from helpers import column_exists  # noqa: E402

revision: str = "0656_hr_bio_k40_comm"
down_revision: str | None = "0655_hr_bio_zkteco_k40_pro"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None

_SCHEMA = "hr"
_TABLE = "hr_biometric_device"


def upgrade() -> None:
    bind = op.get_bind()
    columns = {
        "subnet_mask": sa.String(64),
        "gateway": sa.String(64),
        "comm_password": sa.String(8),
    }
    for name, col_type in columns.items():
        if not column_exists(bind, _TABLE, name, schema=_SCHEMA):
            op.add_column(_TABLE, sa.Column(name, col_type, nullable=True), schema=_SCHEMA)


def downgrade() -> None:
    bind = op.get_bind()
    for name in ("comm_password", "gateway", "subnet_mask"):
        if column_exists(bind, _TABLE, name, schema=_SCHEMA):
            op.drop_column(_TABLE, name, schema=_SCHEMA)
