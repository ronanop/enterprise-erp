"""Add VASCAN configuration checkbox + date after MBSS."""

import sys
from collections.abc import Sequence
from pathlib import Path

import sqlalchemy as sa
from alembic import op

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))

from helpers import add_column_if_missing  # noqa: E402

revision: str = "0472_vascan_checkbox_date"
down_revision: str | None = "0471_site_stage_tracking_dates"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None

TABLE = "prj_site_installation"
SCHEMA = "project"


def upgrade() -> None:
    add_column_if_missing(
        TABLE,
        sa.Column(
            "vascan_done",
            sa.Boolean(),
            nullable=False,
            server_default=sa.text("false"),
        ),
        schema=SCHEMA,
    )
    add_column_if_missing(
        TABLE,
        sa.Column("vascan_date", sa.Date(), nullable=True),
        schema=SCHEMA,
    )


def downgrade() -> None:
    op.drop_column(TABLE, "vascan_date", schema=SCHEMA)
    op.drop_column(TABLE, "vascan_done", schema=SCHEMA)
