"""FP-ASSET-018: asset report indexes and report_type CHECK expansion."""

import sys
from collections.abc import Sequence
from pathlib import Path

import sqlalchemy as sa
from alembic import op

revision: str = "0483_ast_report_governance"
down_revision: str | None = "0482_ast_notification_governance"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None

SCHEMA = "asset"
TABLE = "ast_asset_report"

INDEXES = [
    ("ix_ast_asset_report_company_status", ["company_id", "status"]),
    ("ix_ast_asset_report_company_type", ["company_id", "report_type"]),
    ("ix_ast_asset_report_company_generated", ["company_id", "generated_at"]),
]


def upgrade() -> None:
    sys.path.insert(0, str(Path(__file__).resolve().parents[1]))
    from helpers import index_exists

    bind = op.get_bind()

    op.execute(
        sa.text(
            f"ALTER TABLE {SCHEMA}.{TABLE} DROP CONSTRAINT IF EXISTS ck_ast_asset_report_type"
        )
    )
    op.create_check_constraint(
        "ck_ast_asset_report_type",
        TABLE,
        "report_type IN ("
        "'register','depreciation_schedule','utilization',"
        "'maintenance_due','insurance_expiry','audit_variance',"
        "'warranty_expiry','allocation','transfer','disposal',"
        "'documents','checklists','meters','notifications'"
        ")",
        schema=SCHEMA,
    )

    for index_name, columns in INDEXES:
        if not index_exists(bind, TABLE, index_name, schema=SCHEMA):
            op.create_index(
                index_name,
                TABLE,
                columns,
                schema=SCHEMA,
                postgresql_where=sa.text("is_deleted = false"),
            )


def downgrade() -> None:
    for index_name, _ in reversed(INDEXES):
        op.drop_index(index_name, table_name=TABLE, schema=SCHEMA)

    op.drop_constraint("ck_ast_asset_report_type", TABLE, schema=SCHEMA, type_="check")
    op.create_check_constraint(
        "ck_ast_asset_report_type",
        TABLE,
        "report_type IN ('register','depreciation_schedule','utilization',"
        "'maintenance_due','insurance_expiry','audit_variance')",
        schema=SCHEMA,
    )
