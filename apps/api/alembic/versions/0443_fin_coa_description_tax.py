"""Add description and is_tax_applicable to fin_chart_of_account."""

import sys
from collections.abc import Sequence
from pathlib import Path

import sqlalchemy as sa

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))

from helpers import add_column_if_missing  # noqa: E402

revision: str = "0443_fin_coa_description_tax"
down_revision: str | None = "0442_seed_portal_workflows"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    add_column_if_missing(
        "fin_chart_of_account",
        sa.Column("description", sa.Text(), nullable=True),
        schema="finance",
    )
    add_column_if_missing(
        "fin_chart_of_account",
        sa.Column(
            "is_tax_applicable",
            sa.Boolean(),
            nullable=False,
            server_default=sa.text("false"),
        ),
        schema="finance",
    )


def downgrade() -> None:
    from alembic import op

    op.drop_column("fin_chart_of_account", "is_tax_applicable", schema="finance")
    op.drop_column("fin_chart_of_account", "description", schema="finance")
