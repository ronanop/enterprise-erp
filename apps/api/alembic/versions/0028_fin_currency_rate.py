"""Create fin_currency_rate table."""

from collections.abc import Sequence

from alembic import op

revision: str = "0028_fin_currency_rate"
down_revision: str | None = "0027_fin_period"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    try:
        from modules.finance.models.currency import FinCurrencyRate  # noqa: F401
    except ModuleNotFoundError:
        return
    FinCurrencyRate.__table__.create(bind=op.get_bind(), checkfirst=True)


def downgrade() -> None:
    try:
        from modules.finance.models.currency import FinCurrencyRate  # noqa: F401
    except ModuleNotFoundError:
        return
    FinCurrencyRate.__table__.drop(bind=op.get_bind(), checkfirst=True)
