"""Add scm_on_hold_at on CRM OVF for SCM hold duration."""

import sys
from collections.abc import Sequence
from pathlib import Path

import sqlalchemy as sa

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))

from helpers import add_column_if_missing  # noqa: E402

revision: str = "0476_crm_ovf_scm_on_hold_at"
down_revision: str | None = "0475_proc_order_approved_by_repair"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    add_column_if_missing(
        "crm_ovf",
        sa.Column("scm_on_hold_at", sa.DateTime(timezone=True), nullable=True),
        schema="crm",
    )


def downgrade() -> None:
    from alembic import op

    op.drop_column("crm_ovf", "scm_on_hold_at", schema="crm")
