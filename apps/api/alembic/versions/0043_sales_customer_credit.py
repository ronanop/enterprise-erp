"""Create SalesCustomerCredit table."""

from collections.abc import Sequence

from alembic import op

revision: str = "0043_sales_customer_credit"
down_revision: str | None = "0042_sales_discount_rule"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    try:
        from modules.sales.models.credit import SalesCustomerCredit
    except ModuleNotFoundError:
        # Sales module removed; historical table already applied on existing DBs.
        return
    SalesCustomerCredit.__table__.create(bind=op.get_bind(), checkfirst=True)


def downgrade() -> None:
    try:
        from modules.sales.models.credit import SalesCustomerCredit
    except ModuleNotFoundError:
        return
    SalesCustomerCredit.__table__.drop(bind=op.get_bind(), checkfirst=True)
