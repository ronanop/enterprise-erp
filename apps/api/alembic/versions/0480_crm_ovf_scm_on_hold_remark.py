"""SCM hold remark on CRM OVF."""

import sys
from collections.abc import Sequence
from pathlib import Path

import sqlalchemy as sa

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))

from helpers import add_column_if_missing  # noqa: E402

revision: str = "0480_crm_ovf_scm_on_hold_remark"
down_revision: str | None = "0479_crm_ovf_scm_hold_history"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    add_column_if_missing(
        "crm_ovf",
        sa.Column("scm_on_hold_remark", sa.Text(), nullable=True),
        schema="crm",
    )


def downgrade() -> None:
    pass
