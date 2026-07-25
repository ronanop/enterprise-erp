"""Add description and is_tax_applicable to fin_chart_of_account.

Idempotent: 0025 creates the table from the live ORM model, which may already
include these columns when they were later added to FinChartOfAccount.
"""

from collections.abc import Sequence

import sqlalchemy as sa
from alembic import op

revision: str = "0443_fin_coa_description_tax"
down_revision: str | None = "0442_seed_portal_workflows"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def _existing_columns(table: str, schema: str) -> set[str]:
    bind = op.get_bind()
    return {c["name"] for c in sa.inspect(bind).get_columns(table, schema=schema)}


def upgrade() -> None:
    cols = _existing_columns("fin_chart_of_account", "finance")
    if "description" not in cols:
        op.add_column(
            "fin_chart_of_account",
            sa.Column("description", sa.Text(), nullable=True),
            schema="finance",
        )
    if "is_tax_applicable" not in cols:
        op.add_column(
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
    cols = _existing_columns("fin_chart_of_account", "finance")
    if "is_tax_applicable" in cols:
        op.drop_column("fin_chart_of_account", "is_tax_applicable", schema="finance")
    if "description" in cols:
        op.drop_column("fin_chart_of_account", "description", schema="finance")
