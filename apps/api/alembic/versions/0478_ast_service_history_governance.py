"""FP-ASSET-013: service history search indexes only."""

import sys
from collections.abc import Sequence
from pathlib import Path

import sqlalchemy as sa
from alembic import op

revision: str = "0478_ast_service_history_governance"
down_revision: str | None = "0477_ast_location_governance"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None

SCHEMA = "asset"
TABLE = "ast_asset_service_history"


def upgrade() -> None:
    sys.path.insert(0, str(Path(__file__).resolve().parents[1]))
    from helpers import index_exists

    bind = op.get_bind()

    asset_index = "ix_ast_asset_svc_history_asset_id"
    if not index_exists(bind, TABLE, asset_index, schema=SCHEMA):
        op.create_index(
            asset_index,
            TABLE,
            ["asset_id"],
            schema=SCHEMA,
            postgresql_where=sa.text("is_deleted = false"),
        )

    maint_index = "ix_ast_asset_svc_history_maintenance_id"
    if not index_exists(bind, TABLE, maint_index, schema=SCHEMA):
        op.create_index(
            maint_index,
            TABLE,
            ["maintenance_id"],
            schema=SCHEMA,
            postgresql_where=sa.text("is_deleted = false"),
        )

    serviced_index = "ix_ast_asset_svc_history_serviced_at"
    if not index_exists(bind, TABLE, serviced_index, schema=SCHEMA):
        op.create_index(
            serviced_index,
            TABLE,
            ["serviced_at"],
            schema=SCHEMA,
            postgresql_where=sa.text("is_deleted = false"),
        )


def downgrade() -> None:
    op.drop_index(
        "ix_ast_asset_svc_history_serviced_at",
        table_name=TABLE,
        schema=SCHEMA,
    )
    op.drop_index(
        "ix_ast_asset_svc_history_maintenance_id",
        table_name=TABLE,
        schema=SCHEMA,
    )
    op.drop_index(
        "ix_ast_asset_svc_history_asset_id",
        table_name=TABLE,
        schema=SCHEMA,
    )
