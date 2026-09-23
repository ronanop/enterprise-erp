"""Add IN_MAINTENANCE operational status and backfill from lifecycle."""

from collections.abc import Sequence

import sqlalchemy as sa
from alembic import op

revision: str = "0509_ast_operational_in_maintenance"
down_revision: str | None = "0508_ast_maintenance_reason_duration"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    op.drop_constraint(
        "ck_ast_asset_operational_status",
        "ast_asset",
        schema="asset",
        type_="check",
    )
    op.create_check_constraint(
        "ck_ast_asset_operational_status",
        "ast_asset",
        "operational_status IS NULL OR operational_status IN "
        "('READY_TO_MOVE','ASSIGNED','IN_MAINTENANCE','RETIRED','PENDING_DISPOSAL',"
        "'DISPOSED','IN_USE_AS_COMPONENT')",
        schema="asset",
    )
    op.execute(
        sa.text(
            """
            UPDATE asset.ast_asset
            SET operational_status = 'IN_MAINTENANCE'
            WHERE status = 'in_maintenance'
              AND is_deleted = false
              AND (operational_status IS NULL OR operational_status = 'READY_TO_MOVE')
            """
        )
    )


def downgrade() -> None:
    op.execute(
        sa.text(
            """
            UPDATE asset.ast_asset
            SET operational_status = 'READY_TO_MOVE'
            WHERE operational_status = 'IN_MAINTENANCE' AND is_deleted = false
            """
        )
    )
    op.drop_constraint(
        "ck_ast_asset_operational_status",
        "ast_asset",
        schema="asset",
        type_="check",
    )
    op.create_check_constraint(
        "ck_ast_asset_operational_status",
        "ast_asset",
        "operational_status IS NULL OR operational_status IN "
        "('READY_TO_MOVE','ASSIGNED','RETIRED','PENDING_DISPOSAL','DISPOSED',"
        "'IN_USE_AS_COMPONENT')",
        schema="asset",
    )
