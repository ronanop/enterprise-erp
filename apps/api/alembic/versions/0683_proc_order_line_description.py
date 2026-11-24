"""Store the Create PO item description on each purchase order line."""

from __future__ import annotations

from collections.abc import Sequence

import sqlalchemy as sa
from alembic import op

revision: str = "0683_proc_order_line_description"
down_revision: str | Sequence[str] | None = "0682_crm_ovf_hold_request"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    op.add_column(
        "proc_order_line",
        sa.Column("description", sa.Text(), nullable=True),
        schema="procurement",
    )


def downgrade() -> None:
    op.drop_column("proc_order_line", "description", schema="procurement")
