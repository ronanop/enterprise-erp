"""Create proc_invoice_line table."""

from collections.abc import Sequence

from alembic import op

revision: str = "0072_proc_invoice_line"
down_revision: str | None = "0071_proc_invoice_header"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    try:
        from modules.procurement.models.invoice import ProcInvoiceLine  # noqa: F401
    except ModuleNotFoundError:
        return
    ProcInvoiceLine.__table__.create(bind=op.get_bind(), checkfirst=True)


def downgrade() -> None:
    try:
        from modules.procurement.models.invoice import ProcInvoiceLine  # noqa: F401
    except ModuleNotFoundError:
        return
    ProcInvoiceLine.__table__.drop(bind=op.get_bind(), checkfirst=True)
