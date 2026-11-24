"""Link GRN receipt batches to vendor dispatch waves."""

from __future__ import annotations

from collections.abc import Sequence

import sqlalchemy as sa
from alembic import op

revision: str = "0659_proc_receipt_batch_vendor_dispatch"
down_revision: str | Sequence[str] | None = "0658_proc_order_fulfillment_workflow"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    op.add_column(
        "proc_order_receipt_batch",
        sa.Column("vendor_dispatch_id", sa.UUID(), nullable=True),
        schema="procurement",
    )
    op.create_foreign_key(
        "fk_proc_orb_vendor_dispatch",
        "proc_order_receipt_batch",
        "proc_vendor_dispatch",
        ["vendor_dispatch_id"],
        ["id"],
        source_schema="procurement",
        referent_schema="procurement",
        ondelete="RESTRICT",
    )
    op.create_index(
        "ix_proc_orb_vendor_dispatch_id",
        "proc_order_receipt_batch",
        ["vendor_dispatch_id"],
        unique=False,
        schema="procurement",
    )


def downgrade() -> None:
    op.drop_index(
        "ix_proc_orb_vendor_dispatch_id",
        table_name="proc_order_receipt_batch",
        schema="procurement",
    )
    op.drop_constraint(
        "fk_proc_orb_vendor_dispatch",
        "proc_order_receipt_batch",
        schema="procurement",
        type_="foreignkey",
    )
    op.drop_column("proc_order_receipt_batch", "vendor_dispatch_id", schema="procurement")
