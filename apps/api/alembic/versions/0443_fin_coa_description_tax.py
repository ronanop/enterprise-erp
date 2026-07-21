"""Add description and is_tax_applicable to fin_chart_of_account."""

from collections.abc import Sequence

import sqlalchemy as sa
from alembic import op

revision: str = "0443_fin_coa_description_tax"
down_revision: str | None = "0442_seed_portal_workflows"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    op.add_column(
        "fin_chart_of_account",
        sa.Column("description", sa.Text(), nullable=True),
        schema="finance",
    )
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
    op.drop_column("fin_chart_of_account", "is_tax_applicable", schema="finance")
    op.drop_column("fin_chart_of_account", "description", schema="finance")
