"""Merge OVF stock-allocation branch with GRN delivery-challan head."""

from collections.abc import Sequence

revision: str = "0524_merge_proc_ovf_stock_dc"
down_revision: str | Sequence[str] | None = (
    "0504_proc_ovf_stock_allocation",
    "0523_proc_receipt_delivery_challan_qty",
)
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    pass


def downgrade() -> None:
    pass
