"""Add description and is_default to fin_fiscal_year.

Idempotent: early create migrations may already include these ORM columns.
"""

from collections.abc import Sequence

import sqlalchemy as sa
from alembic import op

revision: str = "0444_fin_fiscal_year_meta"
down_revision: str | None = "0443_fin_coa_description_tax"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def _existing_columns(table: str, schema: str) -> set[str]:
    bind = op.get_bind()
    return {c["name"] for c in sa.inspect(bind).get_columns(table, schema=schema)}


def upgrade() -> None:
    cols = _existing_columns("fin_fiscal_year", "finance")
    if "description" not in cols:
        op.add_column(
            "fin_fiscal_year",
            sa.Column("description", sa.String(length=500), nullable=True),
            schema="finance",
        )
    if "is_default" not in cols:
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
    cols = _existing_columns("fin_fiscal_year", "finance")
    if "is_default" in cols:
        op.drop_column("fin_fiscal_year", "is_default", schema="finance")
    if "description" in cols:
        op.drop_column("fin_fiscal_year", "description", schema="finance")
