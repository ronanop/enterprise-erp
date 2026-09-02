"""Add scm_hold_blocked on CRM OVF — one SCM hold cycle per OVF."""

import sys
from collections.abc import Sequence
from pathlib import Path

import sqlalchemy as sa

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))

from helpers import add_column_if_missing  # noqa: E402

revision: str = "0477_crm_ovf_scm_hold_blocked"
down_revision: str | None = "0476_crm_ovf_scm_on_hold_at"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    add_column_if_missing(
        "crm_ovf",
        sa.Column(
            "scm_hold_blocked",
            sa.Boolean(),
            nullable=False,
            server_default=sa.text("false"),
        ),
        schema="crm",
    )


def downgrade() -> None:
    from alembic import op

    op.drop_column("crm_ovf", "scm_hold_blocked", schema="crm")
