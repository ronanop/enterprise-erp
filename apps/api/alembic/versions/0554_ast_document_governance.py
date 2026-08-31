"""FP-ASSET-016: asset document search indexes."""

import sys
from collections.abc import Sequence
from pathlib import Path

import sqlalchemy as sa
from alembic import op

revision: str = "0554_ast_document_governance"
down_revision: str | None = "0553_ast_meter_reading_governance"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None

SCHEMA = "asset"
TABLE = "ast_asset_document"


def upgrade() -> None:
    sys.path.insert(0, str(Path(__file__).resolve().parents[1]))
    from helpers import index_exists

    bind = op.get_bind()

    for index_name, columns in [
        ("ix_ast_asset_document_asset_id", ["asset_id"]),
        ("ix_ast_asset_document_asset_type_status", ["asset_id", "document_type", "status"]),
        ("ix_ast_asset_document_company_status", ["company_id", "status"]),
        ("ix_ast_asset_document_type", ["document_type"]),
    ]:
        if not index_exists(bind, TABLE, index_name, schema=SCHEMA):
            op.create_index(
                index_name,
                TABLE,
                columns,
                schema=SCHEMA,
                postgresql_where=sa.text("is_deleted = false"),
            )


def downgrade() -> None:
    op.drop_index("ix_ast_asset_document_type", table_name=TABLE, schema=SCHEMA)
    op.drop_index("ix_ast_asset_document_company_status", table_name=TABLE, schema=SCHEMA)
    op.drop_index("ix_ast_asset_document_asset_type_status", table_name=TABLE, schema=SCHEMA)
    op.drop_index("ix_ast_asset_document_asset_id", table_name=TABLE, schema=SCHEMA)
