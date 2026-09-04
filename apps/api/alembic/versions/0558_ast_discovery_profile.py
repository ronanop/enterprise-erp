"""CR-003: add discovery_profile_json to ast_asset (minimal JSON persistence)."""

from collections.abc import Sequence

import sqlalchemy as sa
from alembic import op
from sqlalchemy.dialects import postgresql

revision: str = "0558_ast_discovery_profile"
down_revision: str | None = "0557_ast_component_governance"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None

SCHEMA = "asset"
TABLE = "ast_asset"
COLUMN = "discovery_profile_json"


def upgrade() -> None:
    bind = op.get_bind()
    insp = sa.inspect(bind)
    cols = {c["name"] for c in insp.get_columns(TABLE, schema=SCHEMA)}
    if COLUMN not in cols:
        op.add_column(
            TABLE,
            sa.Column(COLUMN, postgresql.JSONB(astext_type=sa.Text()), nullable=True),
            schema=SCHEMA,
        )


def downgrade() -> None:
    bind = op.get_bind()
    insp = sa.inspect(bind)
    cols = {c["name"] for c in insp.get_columns(TABLE, schema=SCHEMA)}
    if COLUMN in cols:
        op.drop_column(TABLE, COLUMN, schema=SCHEMA)
