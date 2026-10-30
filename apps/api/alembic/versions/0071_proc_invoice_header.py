"""Create proc_invoice_header table."""

from collections.abc import Sequence

from alembic import op

revision: str = "0071_proc_invoice_header"
down_revision: str | None = "0070_proc_vendor_contract_line"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    try:
        from modules.procurement.models.invoice import ProcInvoiceHeader  # noqa: F401
    except ModuleNotFoundError:
        return
    ProcInvoiceHeader.__table__.create(bind=op.get_bind(), checkfirst=True)


def downgrade() -> None:
    try:
        from modules.procurement.models.invoice import ProcInvoiceHeader  # noqa: F401
    except ModuleNotFoundError:
        return
    ProcInvoiceHeader.__table__.drop(bind=op.get_bind(), checkfirst=True)
