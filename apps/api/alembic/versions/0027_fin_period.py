"""Create fin_period table."""

from collections.abc import Sequence

from alembic import op

revision: str = "0027_fin_period"
down_revision: str | None = "0026_fin_fiscal_year"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    try:
        from modules.finance.models.fiscal import FinPeriod  # noqa: F401
    except ModuleNotFoundError:
        return
    FinPeriod.__table__.create(bind=op.get_bind(), checkfirst=True)


def downgrade() -> None:
    try:
        from modules.finance.models.fiscal import FinPeriod  # noqa: F401
    except ModuleNotFoundError:
        return
    FinPeriod.__table__.drop(bind=op.get_bind(), checkfirst=True)
