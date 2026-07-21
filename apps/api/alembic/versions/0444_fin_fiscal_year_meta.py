"""Add description and is_default to fin_fiscal_year."""

from collections.abc import Sequence

import sqlalchemy as sa
from alembic import op

revision: str = "0444_fin_fiscal_year_meta"
down_revision: str | None = "0443_fin_coa_description_tax"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    op.add_column(
        "fin_fiscal_year",
        sa.Column("description", sa.String(length=500), nullable=True),
        schema="finance",
    )
    op.add_column(
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
    op.drop_column("fin_fiscal_year", "is_default", schema="finance")
    op.drop_column("fin_fiscal_year", "description", schema="finance")
