"""Persist SCM last hold window on CRM OVF after unhold."""

import sys
from collections.abc import Sequence
from pathlib import Path

import sqlalchemy as sa

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))

from helpers import add_column_if_missing  # noqa: E402

revision: str = "0478_crm_ovf_scm_last_hold"
down_revision: str | None = "0477_crm_ovf_scm_hold_blocked"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    add_column_if_missing(
        "crm_ovf",
        sa.Column("scm_last_hold_since", sa.DateTime(timezone=True), nullable=True),
        schema="crm",
    )
    add_column_if_missing(
        "crm_ovf",
        sa.Column("scm_last_hold_released_at", sa.DateTime(timezone=True), nullable=True),
        schema="crm",
    )


def downgrade() -> None:
    pass
