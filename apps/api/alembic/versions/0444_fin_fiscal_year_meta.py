"""Add description and is_default to fin_fiscal_year."""

import sys
from collections.abc import Sequence
from pathlib import Path

import sqlalchemy as sa

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))

from helpers import add_column_if_missing  # noqa: E402

revision: str = "0444_fin_fiscal_year_meta"
down_revision: str | None = "0443_fin_coa_description_tax"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    add_column_if_missing(
        "fin_fiscal_year",
        sa.Column("description", sa.String(length=500), nullable=True),
        schema="finance",
    )
    add_column_if_missing(
        "fin_fiscal_year",
        sa.Column(
            "is_default",
            sa.Boolean(),
            nullable=False,
            server_default=sa.text("false"),
        ),
        schema="finance",
    )


def downgrade() -> None:
    from alembic import op

    op.drop_column("fin_fiscal_year", "is_default", schema="finance")
    op.drop_column("fin_fiscal_year", "description", schema="finance")
