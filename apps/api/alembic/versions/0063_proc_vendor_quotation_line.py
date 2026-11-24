"""Create proc_vendor_quotation_line table."""

from collections.abc import Sequence

from alembic import op

revision: str = "0063_proc_vendor_quotation_line"
down_revision: str | None = "0062_proc_vendor_quote_header"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    try:
        from modules.procurement.models.vendor_quotation import ProcVendorQuotationLine  # noqa: F401
    except ModuleNotFoundError:
        return
    ProcVendorQuotationLine.__table__.create(bind=op.get_bind(), checkfirst=True)


def downgrade() -> None:
    try:
        from modules.procurement.models.vendor_quotation import ProcVendorQuotationLine  # noqa: F401
    except ModuleNotFoundError:
        return
    ProcVendorQuotationLine.__table__.drop(bind=op.get_bind(), checkfirst=True)
