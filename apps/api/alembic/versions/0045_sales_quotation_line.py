"""Create SalesQuotationLine table."""

from collections.abc import Sequence

from alembic import op

revision: str = "0045_sales_quotation_line"
down_revision: str | None = "0044_sales_quotation_header"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    try:
        from modules.sales.models.quotation import SalesQuotationLine
    except ModuleNotFoundError:
        # Sales module removed; historical table already applied on existing DBs.
        return
    SalesQuotationLine.__table__.create(bind=op.get_bind(), checkfirst=True)


def downgrade() -> None:
    try:
        from modules.sales.models.quotation import SalesQuotationLine
    except ModuleNotFoundError:
        return
    SalesQuotationLine.__table__.drop(bind=op.get_bind(), checkfirst=True)
