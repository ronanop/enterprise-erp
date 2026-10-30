"""Create SalesInvoiceHeader table."""

from collections.abc import Sequence

from alembic import op

revision: str = "0050_sales_invoice_header"
down_revision: str | None = "0049_sales_delivery_line"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    try:
        from modules.sales.models.invoice import SalesInvoiceHeader
    except ModuleNotFoundError:
        # Sales module removed; historical table already applied on existing DBs.
        return
    SalesInvoiceHeader.__table__.create(bind=op.get_bind(), checkfirst=True)


def downgrade() -> None:
    try:
        from modules.sales.models.invoice import SalesInvoiceHeader
    except ModuleNotFoundError:
        return
    SalesInvoiceHeader.__table__.drop(bind=op.get_bind(), checkfirst=True)
