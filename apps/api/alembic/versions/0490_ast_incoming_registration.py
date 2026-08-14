"""Add registered_asset_id link on incoming units (Sub-phase 3)."""

from collections.abc import Sequence

import sqlalchemy as sa
from alembic import op

revision: str = "0490_ast_incoming_registration"
down_revision: str | None = "0489_ast_incoming_qc"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    op.add_column(
        "ast_incoming_asset_unit",
        sa.Column("registered_asset_id", sa.UUID(), nullable=True),
        schema="asset",
    )
    op.add_column(
        "ast_incoming_asset_unit",
        sa.Column("registered_at", sa.DateTime(timezone=True), nullable=True),
        schema="asset",
    )
    op.add_column(
        "ast_incoming_asset_unit",
        sa.Column("registered_by", sa.UUID(), nullable=True),
        schema="asset",
    )
    op.create_index(
        "ix_ast_incoming_asset_unit_registered_asset_id",
        "ast_incoming_asset_unit",
        ["registered_asset_id"],
        unique=False,
        schema="asset",
    )
    op.create_unique_constraint(
        "uk_ast_incoming_unit_registered_asset",
        "ast_incoming_asset_unit",
        ["registered_asset_id"],
        schema="asset",
    )


def downgrade() -> None:
    op.drop_constraint(
        "uk_ast_incoming_unit_registered_asset",
        "ast_incoming_asset_unit",
        schema="asset",
        type_="unique",
    )
    op.drop_index(
        "ix_ast_incoming_asset_unit_registered_asset_id",
        table_name="ast_incoming_asset_unit",
        schema="asset",
    )
    op.drop_column("ast_incoming_asset_unit", "registered_by", schema="asset")
    op.drop_column("ast_incoming_asset_unit", "registered_at", schema="asset")
    op.drop_column("ast_incoming_asset_unit", "registered_asset_id", schema="asset")
