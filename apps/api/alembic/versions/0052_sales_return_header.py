"""Create SalesReturnHeader table."""

from collections.abc import Sequence

from alembic import op

revision: str = "0052_sales_return_header"
down_revision: str | None = "0051_sales_invoice_line"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    try:
        from modules.sales.models.return_doc import SalesReturnHeader
    except ModuleNotFoundError:
        # Sales module removed; historical table already applied on existing DBs.
        return
    SalesReturnHeader.__table__.create(bind=op.get_bind(), checkfirst=True)


def downgrade() -> None:
    try:
        from modules.sales.models.return_doc import SalesReturnHeader
    except ModuleNotFoundError:
        return
    SalesReturnHeader.__table__.drop(bind=op.get_bind(), checkfirst=True)
