"""Create PtInvoiceView table."""

from collections.abc import Sequence

from alembic import op

revision: str = "0430_pt_invoice_view"
down_revision: str | None = "0429_pt_order_view"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    try:
        from modules.portal.models.invoice_view import PtInvoiceView  # noqa: F401
    except ModuleNotFoundError:
        return
    PtInvoiceView.__table__.create(bind=op.get_bind(), checkfirst=True)


def downgrade() -> None:
    try:
        from modules.portal.models.invoice_view import PtInvoiceView  # noqa: F401
    except ModuleNotFoundError:
        return
    PtInvoiceView.__table__.drop(bind=op.get_bind(), checkfirst=True)
