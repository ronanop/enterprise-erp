"""Add quantity to procurement inventory stock units (supports fractional GRN stock)."""

from collections.abc import Sequence
from pathlib import Path
import sys

import sqlalchemy as sa
from alembic import op

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))

from helpers import add_column_if_missing  # noqa: E402

revision: str = "0510_proc_inventory_stock_qty"
down_revision: str | Sequence[str] | None = "0509_sec_user_module_role"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    add_column_if_missing(
        "proc_inventory_stock_unit",
        sa.Column(
            "quantity",
            sa.Numeric(18, 4),
            nullable=False,
            server_default="1",
        ),
        schema="procurement",
    )


def downgrade() -> None:
    op.drop_column("proc_inventory_stock_unit", "quantity", schema="procurement")
