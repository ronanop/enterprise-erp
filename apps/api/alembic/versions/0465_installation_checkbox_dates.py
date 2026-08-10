"""Add installation checkbox completion dates."""

from collections.abc import Sequence

import sqlalchemy as sa
from alembic import op

revision: str = "0465_installation_checkbox_dates"
down_revision: str | None = "0464_scm_checkbox_dates"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None

TABLE = "prj_site_installation"
SCHEMA = "project"

COLUMNS = (
    "rack_server_stacking_date",
    "rack_server_power_on_date",
    "dac_ilo_cabling_date",
)


def upgrade() -> None:
    for name in COLUMNS:
        op.add_column(
            TABLE,
            sa.Column(name, sa.Date(), nullable=True),
            schema=SCHEMA,
        )


def downgrade() -> None:
    for name in reversed(COLUMNS):
        op.drop_column(TABLE, name, schema=SCHEMA)
