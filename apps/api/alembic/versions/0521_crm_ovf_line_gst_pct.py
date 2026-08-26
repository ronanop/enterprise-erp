"""Optional gst_pct on CRM OVF lines (idempotent; matches stamped environments)."""

import sys
from collections.abc import Sequence
from pathlib import Path

import sqlalchemy as sa
from alembic import op

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))

from helpers import column_exists  # noqa: E402

revision: str = "0521_crm_ovf_line_gst_pct"
down_revision: str | Sequence[str] | None = "0520_crm_ovf_line_charge_fields"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    bind = op.get_bind()
    if column_exists(bind, "crm_ovf_line", "gst_pct", schema="crm"):
        return
    op.add_column(
        "crm_ovf_line",
        sa.Column("gst_pct", sa.Numeric(5, 2), nullable=True),
        schema="crm",
    )


def downgrade() -> None:
    bind = op.get_bind()
    if not column_exists(bind, "crm_ovf_line", "gst_pct", schema="crm"):
        return
    op.drop_column("crm_ovf_line", "gst_pct", schema="crm")
