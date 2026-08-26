"""Add gst_pct on CRM OVF lines for charge-table round-trip."""

import sys
from collections.abc import Sequence
from pathlib import Path

import sqlalchemy as sa

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))

from helpers import add_column_if_missing  # noqa: E402

revision: str = "0521_crm_ovf_line_gst_pct"
down_revision: str | None = "0520_crm_ovf_line_charge_fields"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    add_column_if_missing(
        "crm_ovf_line",
        sa.Column("gst_pct", sa.Numeric(6, 3), nullable=False, server_default="18"),
        schema="crm",
    )


def downgrade() -> None:
    from alembic import op

    op.drop_column("crm_ovf_line", "gst_pct", schema="crm")
