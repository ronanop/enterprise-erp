"""Add description to procurement inventory import lines."""

import sys
from collections.abc import Sequence
from pathlib import Path

import sqlalchemy as sa
from alembic import op

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))

from helpers import column_exists  # noqa: E402

revision: str = "0522_proc_inventory_import_description"
down_revision: str | Sequence[str] | None = "0521_crm_ovf_line_gst_pct"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    bind = op.get_bind()
    if column_exists(bind, "proc_inventory_import_line", "description", schema="procurement"):
        return
    op.add_column(
        "proc_inventory_import_line",
        sa.Column("description", sa.String(length=255), nullable=True),
        schema="procurement",
    )


def downgrade() -> None:
    bind = op.get_bind()
    if not column_exists(bind, "proc_inventory_import_line", "description", schema="procurement"):
        return
    op.drop_column("proc_inventory_import_line", "description", schema="procurement")
