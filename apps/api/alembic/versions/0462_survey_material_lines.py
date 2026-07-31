"""Add survey type+qty JSON lines for rack delivery materials."""

from collections.abc import Sequence
from pathlib import Path
import sys

import sqlalchemy as sa
from alembic import op
from sqlalchemy.dialects import postgresql

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))
from helpers import add_column_if_missing, column_exists

revision: str = "0462_survey_material_lines"
down_revision: str | None = "0461_site_delivery_scopes"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None

TABLE = "prj_site_installation"
SCHEMA = "project"


def upgrade() -> None:
    add_column_if_missing(
        TABLE,
        sa.Column(
            "cable_lines",
            postgresql.JSONB(astext_type=sa.Text()),
            nullable=False,
            server_default=sa.text("'[]'::jsonb"),
        ),
        schema=SCHEMA,
    )
    add_column_if_missing(
        TABLE,
        sa.Column(
            "lug_lines",
            postgresql.JSONB(astext_type=sa.Text()),
            nullable=False,
            server_default=sa.text("'[]'::jsonb"),
        ),
        schema=SCHEMA,
    )
    add_column_if_missing(
        TABLE,
        sa.Column(
            "industrial_socket_lines",
            postgresql.JSONB(astext_type=sa.Text()),
            nullable=False,
            server_default=sa.text("'[]'::jsonb"),
        ),
        schema=SCHEMA,
    )


def downgrade() -> None:
    bind = op.get_bind()
    for col in ("industrial_socket_lines", "lug_lines", "cable_lines"):
        if column_exists(bind, TABLE, col, schema=SCHEMA):
            op.drop_column(TABLE, col, schema=SCHEMA)
