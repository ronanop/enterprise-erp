"""Allow Projects PO Queue seed rows without a procurement PO (test data).

Makes proc_order_id nullable and adds denormalized PO display fields for
seed handoffs that never touch SCM.
"""

from __future__ import annotations

from collections.abc import Sequence

import sqlalchemy as sa
from alembic import op

revision: str = "0621_prj_po_queue_seed_handoff"
down_revision: str | Sequence[str] | None = "0620_crm_lead_deal_type_widen"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    op.drop_constraint(
        "uk_prj_po_queue_handoff_order",
        "prj_po_queue_handoff",
        schema="project",
        type_="unique",
    )
    op.alter_column(
        "prj_po_queue_handoff",
        "proc_order_id",
        existing_type=sa.UUID(),
        nullable=True,
        schema="project",
    )
    op.create_index(
        "uq_prj_po_queue_handoff_order_active",
        "prj_po_queue_handoff",
        ["tenant_id", "proc_order_id"],
        unique=True,
        schema="project",
        postgresql_where=sa.text("proc_order_id IS NOT NULL AND is_deleted = false"),
    )
    op.add_column(
        "prj_po_queue_handoff",
        sa.Column("is_seed", sa.Boolean(), nullable=False, server_default=sa.text("false")),
        schema="project",
    )
    op.add_column(
        "prj_po_queue_handoff",
        sa.Column("customer_po_number", sa.String(length=100), nullable=True),
        schema="project",
    )
    op.add_column(
        "prj_po_queue_handoff",
        sa.Column("company_po_number", sa.String(length=100), nullable=True),
        schema="project",
    )
    op.add_column(
        "prj_po_queue_handoff",
        sa.Column("document_date", sa.Date(), nullable=True),
        schema="project",
    )
    op.add_column(
        "prj_po_queue_handoff",
        sa.Column("customer_name", sa.String(length=255), nullable=True),
        schema="project",
    )
    op.add_column(
        "prj_po_queue_handoff",
        sa.Column("seed_marker", sa.String(length=80), nullable=True),
        schema="project",
    )


def downgrade() -> None:
    op.drop_column("prj_po_queue_handoff", "seed_marker", schema="project")
    op.drop_column("prj_po_queue_handoff", "customer_name", schema="project")
    op.drop_column("prj_po_queue_handoff", "document_date", schema="project")
    op.drop_column("prj_po_queue_handoff", "company_po_number", schema="project")
    op.drop_column("prj_po_queue_handoff", "customer_po_number", schema="project")
    op.drop_column("prj_po_queue_handoff", "is_seed", schema="project")
    op.drop_index(
        "uq_prj_po_queue_handoff_order_active",
        table_name="prj_po_queue_handoff",
        schema="project",
    )
    op.alter_column(
        "prj_po_queue_handoff",
        "proc_order_id",
        existing_type=sa.UUID(),
        nullable=False,
        schema="project",
    )
    op.create_unique_constraint(
        "uk_prj_po_queue_handoff_order",
        "prj_po_queue_handoff",
        ["tenant_id", "proc_order_id"],
        schema="project",
    )
