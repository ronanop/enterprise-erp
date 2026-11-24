"""Create fin_customer_ledger table."""

from collections.abc import Sequence

from alembic import op

revision: str = "0032_fin_customer_ledger"
down_revision: str | None = "0031_fin_gl_entry"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    try:
        from modules.finance.models.ledger import FinCustomerLedger  # noqa: F401
    except ModuleNotFoundError:
        return
    FinCustomerLedger.__table__.create(bind=op.get_bind(), checkfirst=True)


def downgrade() -> None:
    try:
        from modules.finance.models.ledger import FinCustomerLedger  # noqa: F401
    except ModuleNotFoundError:
        return
    FinCustomerLedger.__table__.drop(bind=op.get_bind(), checkfirst=True)
