"""Add make/model/configuration registration attributes on ast_asset (Sub-phase 4A)."""

from collections.abc import Sequence

import sqlalchemy as sa
from alembic import op

revision: str = "0491_ast_asset_registration_attrs"
down_revision: str | None = "0490_ast_incoming_registration"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    op.add_column(
        "ast_asset",
        sa.Column("make", sa.String(length=100), nullable=True),
        schema="asset",
    )
    op.add_column(
        "ast_asset",
        sa.Column("model", sa.String(length=100), nullable=True),
        schema="asset",
    )
    op.add_column(
        "ast_asset",
        sa.Column("configuration", sa.String(length=500), nullable=True),
        schema="asset",
    )


def downgrade() -> None:
    op.drop_column("ast_asset", "configuration", schema="asset")
    op.drop_column("ast_asset", "model", schema="asset")
    op.drop_column("ast_asset", "make", schema="asset")
