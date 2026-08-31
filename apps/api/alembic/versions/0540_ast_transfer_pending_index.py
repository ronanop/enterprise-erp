"""FP-ASSET-002 remediation: pending transfer lookup index."""

from collections.abc import Sequence
from pathlib import Path
import sys

import sqlalchemy as sa
from alembic import op

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))
from helpers import create_index_if_missing, index_exists

revision: str = "0540_ast_transfer_pending_index"
down_revision: str | None = "0539_ast_transfer_governance"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None

SCHEMA = "asset"
TABLE = "ast_asset_transfer"
INDEX = "ix_ast_asset_transfer_asset_status_active"


def upgrade() -> None:
    bind = op.get_bind()
    if index_exists(bind, TABLE, INDEX, schema=SCHEMA):
        return
    op.create_index(
        INDEX,
        TABLE,
        ["asset_id", "status"],
        schema=SCHEMA,
        postgresql_where=sa.text(
            "is_deleted = false AND status IN ('draft','submitted','approved')"
        ),
    )


def downgrade() -> None:
    bind = op.get_bind()
    if index_exists(bind, TABLE, INDEX, schema=SCHEMA):
        op.drop_index(INDEX, table_name=TABLE, schema=SCHEMA)
