"""Add SCM checkbox completion dates for MO and material handover."""

from collections.abc import Sequence

import sqlalchemy as sa
from alembic import op

revision: str = "0464_scm_checkbox_dates"
down_revision: str | None = "0463_survey_dates"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None

TABLE = "prj_site_installation"
SCHEMA = "project"

COLUMNS = (
    "mo_request_date",
    "im_material_date",
    "material_handover_date",
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
