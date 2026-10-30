"""Create fin_vendor_ledger table."""

from collections.abc import Sequence

from alembic import op

revision: str = "0033_fin_vendor_ledger"
down_revision: str | None = "0032_fin_customer_ledger"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    try:
        from modules.finance.models.ledger import FinVendorLedger  # noqa: F401
    except ModuleNotFoundError:
        return
    FinVendorLedger.__table__.create(bind=op.get_bind(), checkfirst=True)


def downgrade() -> None:
    try:
        from modules.finance.models.ledger import FinVendorLedger  # noqa: F401
    except ModuleNotFoundError:
        return
    FinVendorLedger.__table__.drop(bind=op.get_bind(), checkfirst=True)
