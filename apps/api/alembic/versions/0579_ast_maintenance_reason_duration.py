"""Add reason and expected_duration_days to ast_asset_maintenance."""

import sys
from collections.abc import Sequence
from pathlib import Path

import sqlalchemy as sa
from alembic import op

sys.path.insert(0, str(Path(__file__).resolve().parents[2] / "src"))

revision: str = "0579_ast_maintenance_reason_duration"
down_revision: str | None = "0578_ast_component_asset_link"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    op.add_column(
        "ast_asset_maintenance",
        sa.Column("reason", sa.Text(), nullable=True),
        schema="asset",
    )
    op.add_column(
        "ast_asset_maintenance",
        sa.Column("expected_duration_days", sa.Integer(), nullable=True),
        schema="asset",
    )


def downgrade() -> None:
    op.drop_column("ast_asset_maintenance", "expected_duration_days", schema="asset")
    op.drop_column("ast_asset_maintenance", "reason", schema="asset")
