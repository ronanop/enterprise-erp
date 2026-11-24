"""Create fin_tax_register table."""

from collections.abc import Sequence

from alembic import op

revision: str = "0034_fin_tax_register"
down_revision: str | None = "0033_fin_vendor_ledger"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    try:
        from modules.finance.models.tax import FinTaxRegister  # noqa: F401
    except ModuleNotFoundError:
        return
    FinTaxRegister.__table__.create(bind=op.get_bind(), checkfirst=True)


def downgrade() -> None:
    try:
        from modules.finance.models.tax import FinTaxRegister  # noqa: F401
    except ModuleNotFoundError:
        return
    FinTaxRegister.__table__.drop(bind=op.get_bind(), checkfirst=True)
