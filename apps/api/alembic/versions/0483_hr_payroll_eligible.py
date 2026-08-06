"""Add payroll_eligible on hr_employment for post-activation gate."""

import sys
from collections.abc import Sequence
from pathlib import Path

import sqlalchemy as sa
from alembic import op

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))

from helpers import add_column_if_missing  # noqa: E402

revision: str = "0483_hr_payroll_eligible"
down_revision: str | None = "0482_hr_att_enterprise"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    add_column_if_missing(
        "hr_employment",
        sa.Column(
            "payroll_eligible",
            sa.Boolean(),
            nullable=False,
            server_default=sa.text("false"),
        ),
        schema="hr",
    )


def downgrade() -> None:
    op.drop_column("hr_employment", "payroll_eligible", schema="hr")
