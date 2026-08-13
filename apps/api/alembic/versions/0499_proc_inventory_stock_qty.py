"""Add quantity to procurement inventory stock units (supports fractional GRN stock)."""

from collections.abc import Sequence

import sqlalchemy as sa
from alembic import op

revision: str = "0499_proc_inventory_stock_qty"
down_revision: str | Sequence[str] | None = "0498_prj_project_proc_order"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    op.add_column(
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
