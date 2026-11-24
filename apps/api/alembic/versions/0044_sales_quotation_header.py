"""Create SalesQuotationHeader table."""

from collections.abc import Sequence

from alembic import op

revision: str = "0044_sales_quotation_header"
down_revision: str | None = "0043_sales_customer_credit"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    try:
        from modules.sales.models.quotation import SalesQuotationHeader
    except ModuleNotFoundError:
        # Sales module removed; historical table already applied on existing DBs.
        return
    SalesQuotationHeader.__table__.create(bind=op.get_bind(), checkfirst=True)


def downgrade() -> None:
    try:
        from modules.sales.models.quotation import SalesQuotationHeader
    except ModuleNotFoundError:
        return
    SalesQuotationHeader.__table__.drop(bind=op.get_bind(), checkfirst=True)
