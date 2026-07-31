"""FP-ASSET-014: checklist search indexes and code uniqueness."""

import sys
from collections.abc import Sequence
from pathlib import Path

import sqlalchemy as sa
from alembic import op

revision: str = "0479_ast_checklist_governance"
down_revision: str | None = "0478_ast_service_history_governance"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None

SCHEMA = "asset"
TABLE = "ast_asset_checklist"


def upgrade() -> None:
    sys.path.insert(0, str(Path(__file__).resolve().parents[1]))
    from helpers import index_exists

    bind = op.get_bind()

    for index_name, columns in [
        ("ix_ast_asset_checklist_asset_id", ["asset_id"]),
        ("ix_ast_asset_checklist_maintenance_id", ["maintenance_id"]),
        ("ix_ast_asset_checklist_audit_id", ["audit_id"]),
        ("ix_ast_asset_checklist_company_status", ["company_id", "status"]),
    ]:
        if not index_exists(bind, TABLE, index_name, schema=SCHEMA):
            op.create_index(
                index_name,
                TABLE,
                columns,
                schema=SCHEMA,
                postgresql_where=sa.text("is_deleted = false"),
            )

    code_index = "uk_ast_asset_checklist_company_code"
    if not index_exists(bind, TABLE, code_index, schema=SCHEMA):
        op.create_index(
            code_index,
            TABLE,
            ["company_id", "checklist_code"],
            schema=SCHEMA,
            unique=True,
            postgresql_where=sa.text("is_deleted = false"),
        )


def downgrade() -> None:
    op.drop_index("uk_ast_asset_checklist_company_code", table_name=TABLE, schema=SCHEMA)
    op.drop_index("ix_ast_asset_checklist_company_status", table_name=TABLE, schema=SCHEMA)
    op.drop_index("ix_ast_asset_checklist_audit_id", table_name=TABLE, schema=SCHEMA)
    op.drop_index("ix_ast_asset_checklist_maintenance_id", table_name=TABLE, schema=SCHEMA)
    op.drop_index("ix_ast_asset_checklist_asset_id", table_name=TABLE, schema=SCHEMA)
