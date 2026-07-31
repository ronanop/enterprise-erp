"""Add survey completion dates for materials and readiness checks."""

from collections.abc import Sequence
from pathlib import Path
import sys

import sqlalchemy as sa
from alembic import op

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))
from helpers import add_column_if_missing, column_exists

revision: str = "0463_survey_dates"
down_revision: str | None = "0462_survey_material_lines"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None

TABLE = "prj_site_installation"
SCHEMA = "project"

COLUMNS = (
    "power_on_material_date",
    "survey_completed_date",
    "space_available_date",
    "power_available_date",
)


def upgrade() -> None:
    for name in COLUMNS:
        add_column_if_missing(
            TABLE,
            sa.Column(name, sa.Date(), nullable=True),
            schema=SCHEMA,
        )


def downgrade() -> None:
    bind = op.get_bind()
    for name in reversed(COLUMNS):
        if column_exists(bind, TABLE, name, schema=SCHEMA):
            op.drop_column(TABLE, name, schema=SCHEMA)
