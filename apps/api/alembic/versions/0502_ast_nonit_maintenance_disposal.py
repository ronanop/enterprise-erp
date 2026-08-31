"""Additive Non-IT maintenance + disposal columns on ast_nonit_asset.

Does not alter IT tables or free disposed asset codes.
"""

import sys
from collections.abc import Sequence
from pathlib import Path

import sqlalchemy as sa
from alembic import op

sys.path.insert(0, str(Path(__file__).resolve().parents[2] / "src"))

revision: str = "0502_ast_nonit_maintenance_disposal"
down_revision: str | None = "0501_ast_nonit_asset"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    op.add_column(
        "ast_nonit_asset",
        sa.Column("maintenance_reason", sa.String(255), nullable=True),
        schema="asset",
    )
    op.add_column(
        "ast_nonit_asset",
        sa.Column("maintenance_notes", sa.Text(), nullable=True),
        schema="asset",
    )
    op.add_column(
        "ast_nonit_asset",
        sa.Column("maintenance_started_at", sa.DateTime(timezone=True), nullable=True),
        schema="asset",
    )
    op.add_column(
        "ast_nonit_asset",
        sa.Column("maintenance_provider", sa.String(255), nullable=True),
        schema="asset",
    )
    op.add_column(
        "ast_nonit_asset",
        sa.Column("maintenance_cost", sa.Numeric(18, 4), nullable=True),
        schema="asset",
    )
    op.add_column(
        "ast_nonit_asset",
        sa.Column("disposal_reason", sa.String(255), nullable=True),
        schema="asset",
    )
    op.add_column(
        "ast_nonit_asset",
        sa.Column("disposal_date", sa.Date(), nullable=True),
        schema="asset",
    )


def downgrade() -> None:
    op.drop_column("ast_nonit_asset", "disposal_date", schema="asset")
    op.drop_column("ast_nonit_asset", "disposal_reason", schema="asset")
    op.drop_column("ast_nonit_asset", "maintenance_cost", schema="asset")
    op.drop_column("ast_nonit_asset", "maintenance_provider", schema="asset")
    op.drop_column("ast_nonit_asset", "maintenance_started_at", schema="asset")
    op.drop_column("ast_nonit_asset", "maintenance_notes", schema="asset")
    op.drop_column("ast_nonit_asset", "maintenance_reason", schema="asset")
