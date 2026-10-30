"""Create SalesInvoiceLine table."""

from collections.abc import Sequence

from alembic import op

revision: str = "0051_sales_invoice_line"
down_revision: str | None = "0050_sales_invoice_header"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    try:
        from modules.sales.models.invoice import SalesInvoiceLine
    except ModuleNotFoundError:
        # Sales module removed; historical table already applied on existing DBs.
        return
    SalesInvoiceLine.__table__.create(bind=op.get_bind(), checkfirst=True)


def downgrade() -> None:
    try:
        from modules.sales.models.invoice import SalesInvoiceLine
    except ModuleNotFoundError:
        return
    SalesInvoiceLine.__table__.drop(bind=op.get_bind(), checkfirst=True)
