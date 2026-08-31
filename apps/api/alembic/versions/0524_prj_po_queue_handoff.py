"""Persist Projects PO Queue handoffs (Installation → PO Queue share)."""

from collections.abc import Sequence

import sqlalchemy as sa
from alembic import op

revision: str = "0524_prj_po_queue_handoff"
down_revision: str | Sequence[str] | None = "0523_proc_receipt_delivery_challan_qty"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    op.create_table(
        "prj_po_queue_handoff",
        sa.Column("id", sa.UUID(), nullable=False),
        sa.Column("tenant_id", sa.UUID(), nullable=False),
        sa.Column("company_id", sa.UUID(), nullable=False),
        sa.Column("branch_id", sa.UUID(), nullable=False),
        sa.Column("proc_order_id", sa.UUID(), nullable=False),
        sa.Column("challan_id", sa.String(length=64), nullable=True),
        sa.Column("shared_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("project_name", sa.String(length=255), nullable=True),
        sa.Column("circle_name", sa.String(length=255), nullable=True),
        sa.Column("site_name", sa.String(length=255), nullable=True),
        sa.Column("contact_person", sa.String(length=255), nullable=True),
        sa.Column("contact_number", sa.String(length=64), nullable=True),
        sa.Column("rack_quantity", sa.String(length=32), nullable=True),
        sa.Column("server_quantity", sa.String(length=32), nullable=True),
        sa.Column("server_type", sa.String(length=255), nullable=True),
        sa.Column("remarks", sa.Text(), nullable=True),
        sa.Column(
            "created_at",
            sa.DateTime(timezone=True),
            server_default=sa.text("now()"),
            nullable=False,
        ),
        sa.Column("created_by", sa.UUID(), nullable=True),
        sa.Column(
            "updated_at",
            sa.DateTime(timezone=True),
            server_default=sa.text("now()"),
            nullable=False,
        ),
        sa.Column("updated_by", sa.UUID(), nullable=True),
        sa.Column("version", sa.Integer(), nullable=False),
        sa.Column("is_deleted", sa.Boolean(), nullable=False),
        sa.Column("deleted_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("deleted_by", sa.UUID(), nullable=True),
        sa.ForeignKeyConstraint(
            ["branch_id"],
            ["organization.org_branch.id"],
            ondelete="RESTRICT",
        ),
        sa.ForeignKeyConstraint(
            ["proc_order_id"],
            ["procurement.proc_order_header.id"],
            ondelete="RESTRICT",
        ),
        sa.PrimaryKeyConstraint("id"),
        sa.UniqueConstraint(
            "tenant_id",
            "proc_order_id",
            name="uk_prj_po_queue_handoff_order",
        ),
        schema="project",
    )
    op.create_index(
        "ix_prj_po_queue_handoff_proc_order_id",
        "prj_po_queue_handoff",
        ["proc_order_id"],
        schema="project",
    )
    op.create_index(
        "ix_prj_po_queue_handoff_branch_id",
        "prj_po_queue_handoff",
        ["branch_id"],
        schema="project",
    )


def downgrade() -> None:
    op.drop_index(
        "ix_prj_po_queue_handoff_branch_id",
        table_name="prj_po_queue_handoff",
        schema="project",
    )
    op.drop_index(
        "ix_prj_po_queue_handoff_proc_order_id",
        table_name="prj_po_queue_handoff",
        schema="project",
    )
    op.drop_table("prj_po_queue_handoff", schema="project")
