"""Create fin_chart_of_account table."""

from collections.abc import Sequence

from alembic import op

revision: str = "0025_fin_chart_of_account"
down_revision: str | None = "0024_fin_account_group"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    try:
        from modules.finance.models.coa import FinChartOfAccount  # noqa: F401
    except ModuleNotFoundError:
        return
    FinChartOfAccount.__table__.create(bind=op.get_bind(), checkfirst=True)


def downgrade() -> None:
    try:
        from modules.finance.models.coa import FinChartOfAccount  # noqa: F401
    except ModuleNotFoundError:
        return
    FinChartOfAccount.__table__.drop(bind=op.get_bind(), checkfirst=True)
