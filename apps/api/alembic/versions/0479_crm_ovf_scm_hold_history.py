"""SCM hold history on CRM OVF (repeatable hold / unhold)."""

import sys
from collections.abc import Sequence
from pathlib import Path

import sqlalchemy as sa
from sqlalchemy.dialects.postgresql import JSONB

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))

from helpers import add_column_if_missing  # noqa: E402

revision: str = "0479_crm_ovf_scm_hold_history"
down_revision: str | None = "0478_crm_ovf_scm_last_hold"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    add_column_if_missing(
        "crm_ovf",
        sa.Column("scm_hold_history", JSONB, nullable=True),
        schema="crm",
    )


def downgrade() -> None:
    pass
