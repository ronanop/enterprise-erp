"""Add nullable source_kpi_key on analytics.bi_kpi."""

from collections.abc import Sequence

import sqlalchemy as sa

from alembic import op
from helpers import add_column_if_missing, column_exists

revision: str = "0514_bi_kpi_source_kpi_key"
down_revision: str | None = "0513_seed_qm_phase16_workflows"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    add_column_if_missing(
        "bi_kpi",
        sa.Column("source_kpi_key", sa.String(length=80), nullable=True),
        schema="analytics",
    )


def downgrade() -> None:
    bind = op.get_bind()
    if column_exists(bind, "bi_kpi", "source_kpi_key", schema="analytics"):
        op.drop_column("bi_kpi", "source_kpi_key", schema="analytics")
