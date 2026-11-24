"""Create proc_vendor_comparison table."""

from collections.abc import Sequence

from alembic import op

revision: str = "0064_proc_vendor_comparison"
down_revision: str | None = "0063_proc_vendor_quotation_line"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    try:
        from modules.procurement.models.vendor_quotation import ProcVendorComparison  # noqa: F401
    except ModuleNotFoundError:
        return
    ProcVendorComparison.__table__.create(bind=op.get_bind(), checkfirst=True)


def downgrade() -> None:
    try:
        from modules.procurement.models.vendor_quotation import ProcVendorComparison  # noqa: F401
    except ModuleNotFoundError:
        return
    ProcVendorComparison.__table__.drop(bind=op.get_bind(), checkfirst=True)
