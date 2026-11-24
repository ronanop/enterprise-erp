"""PO fulfillment stage columns and vendor dispatch tables."""

from __future__ import annotations

from collections.abc import Sequence

import sqlalchemy as sa
from alembic import op
from sqlalchemy.dialects import postgresql

revision: str = "0658_proc_order_fulfillment_workflow"
down_revision: str | Sequence[str] | None = "0657_crm_quote_line_sub_product_category"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None

_FULFILLMENT_STAGES = (
    "awaiting_vendor_send",
    "awaiting_vendor_response",
    "vendor_rejected",
    "vendor_accepted",
    "customer_notified",
    "vendor_dispatch_recorded",
    "grn_in_stock",
    "customer_delivery_ready",
    "customer_dispatched",
    "delivered",
)


def upgrade() -> None:
    op.add_column(
        "proc_order_header",
        sa.Column("fulfillment_stage", sa.String(length=40), nullable=True),
        schema="procurement",
    )
    op.add_column(
        "proc_order_header",
        sa.Column(
            "vendor_response_status",
            sa.String(length=20),
            nullable=False,
            server_default="pending",
        ),
        schema="procurement",
    )
    op.add_column(
        "proc_order_header",
        sa.Column("vendor_response_remark", sa.Text(), nullable=True),
        schema="procurement",
    )
    op.add_column(
        "proc_order_header",
        sa.Column("vendor_responded_at", sa.DateTime(timezone=True), nullable=True),
        schema="procurement",
    )
    op.add_column(
        "proc_order_header",
        sa.Column("customer_promised_delivery_date", sa.Date(), nullable=True),
        schema="procurement",
    )
    op.add_column(
        "proc_order_header",
        sa.Column("po_sent_to_vendor_at", sa.DateTime(timezone=True), nullable=True),
        schema="procurement",
    )
    op.add_column(
        "proc_order_header",
        sa.Column("customer_order_processed_sent_at", sa.DateTime(timezone=True), nullable=True),
        schema="procurement",
    )
    op.add_column(
        "proc_order_header",
        sa.Column("customer_dispatch_shared_at", sa.DateTime(timezone=True), nullable=True),
        schema="procurement",
    )
    op.add_column(
        "proc_order_header",
        sa.Column("customer_pod_uploaded_at", sa.DateTime(timezone=True), nullable=True),
        schema="procurement",
    )
    op.add_column(
        "proc_order_header",
        sa.Column(
            "customer_delivery_meta",
            postgresql.JSONB(astext_type=sa.Text()),
            nullable=True,
        ),
        schema="procurement",
    )
    op.create_check_constraint(
        "ck_proc_oh_fulfillment_stage",
        "proc_order_header",
        "fulfillment_stage IS NULL OR fulfillment_stage IN ("
        + ", ".join(f"'{s}'" for s in _FULFILLMENT_STAGES)
        + ")",
        schema="procurement",
    )
    op.create_check_constraint(
        "ck_proc_oh_vendor_response_status",
        "proc_order_header",
        "vendor_response_status IN ('pending', 'accepted', 'rejected')",
        schema="procurement",
    )
    op.create_index(
        "ix_proc_oh_fulfillment_stage",
        "proc_order_header",
        ["fulfillment_stage"],
        unique=False,
        schema="procurement",
    )

    # Backfill CRM issued POs into a sensible starting stage so in-flight GRNs stay usable.
    op.execute(
        """
        UPDATE procurement.proc_order_header
        SET fulfillment_stage = CASE
          WHEN status IN ('received', 'closed')
            OR COALESCE(received_amount, 0) > 0
            OR EXISTS (
              SELECT 1
              FROM procurement.proc_order_line ol
              WHERE ol.order_header_id = proc_order_header.id
                AND ol.is_deleted = false
                AND COALESCE(ol.quantity_received, 0) > 0
            )
            THEN 'customer_delivery_ready'
          WHEN customer_ack_sent_at IS NOT NULL
            THEN 'customer_notified'
          ELSE 'awaiting_vendor_send'
        END
        WHERE source_module = 'crm'
          AND is_deleted = false
          AND status IN ('sent', 'approved', 'partially_received', 'received', 'closed')
          AND fulfillment_stage IS NULL
        """
    )

    op.create_table(
        "proc_vendor_dispatch",
        sa.Column("id", sa.UUID(), nullable=False),
        sa.Column("tenant_id", sa.UUID(), nullable=False),
        sa.Column("company_id", sa.UUID(), nullable=False),
        sa.Column("branch_id", sa.UUID(), nullable=False),
        sa.Column("order_header_id", sa.UUID(), nullable=False),
        sa.Column("sequence", sa.Integer(), nullable=False),
        sa.Column("dc_number", sa.String(length=80), nullable=True),
        sa.Column("invoice_number", sa.String(length=80), nullable=True),
        sa.Column("lr_awb_number", sa.String(length=100), nullable=True),
        sa.Column("dispatch_date", sa.Date(), nullable=True),
        sa.Column("eway_notes", sa.Text(), nullable=True),
        sa.Column("transport_notes", sa.Text(), nullable=True),
        sa.Column(
            "attachment_refs",
            postgresql.JSONB(astext_type=sa.Text()),
            nullable=True,
        ),
        sa.Column(
            "status",
            sa.String(length=20),
            nullable=False,
            server_default="recorded",
        ),
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
        sa.Column("is_deleted", sa.Boolean(), server_default=sa.text("false"), nullable=False),
        sa.Column("deleted_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("deleted_by", sa.UUID(), nullable=True),
        sa.Column("version", sa.Integer(), server_default=sa.text("1"), nullable=False),
        sa.ForeignKeyConstraint(
            ["tenant_id"], ["foundation.sec_tenant.id"], ondelete="RESTRICT"
        ),
        sa.ForeignKeyConstraint(
            ["company_id"], ["organization.org_company.id"], ondelete="RESTRICT"
        ),
        sa.ForeignKeyConstraint(
            ["branch_id"], ["organization.org_branch.id"], ondelete="RESTRICT"
        ),
        sa.ForeignKeyConstraint(
            ["order_header_id"],
            ["procurement.proc_order_header.id"],
            ondelete="RESTRICT",
        ),
        sa.PrimaryKeyConstraint("id"),
        sa.UniqueConstraint(
            "order_header_id",
            "sequence",
            name="uk_proc_vd_header_seq",
        ),
        sa.CheckConstraint(
            "status IN ('recorded', 'grn_done', 'cancelled')",
            name="ck_proc_vd_status",
        ),
        schema="procurement",
    )
    op.create_index(
        "ix_proc_vendor_dispatch_tenant_id",
        "proc_vendor_dispatch",
        ["tenant_id"],
        unique=False,
        schema="procurement",
    )
    op.create_index(
        "ix_proc_vendor_dispatch_order_header_id",
        "proc_vendor_dispatch",
        ["order_header_id"],
        unique=False,
        schema="procurement",
    )

    op.create_table(
        "proc_vendor_dispatch_line",
        sa.Column("id", sa.UUID(), nullable=False),
        sa.Column("tenant_id", sa.UUID(), nullable=False),
        sa.Column("company_id", sa.UUID(), nullable=False),
        sa.Column("branch_id", sa.UUID(), nullable=False),
        sa.Column("dispatch_id", sa.UUID(), nullable=False),
        sa.Column("order_line_id", sa.UUID(), nullable=False),
        sa.Column("dispatch_qty", sa.Numeric(18, 4), nullable=False),
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
        sa.Column("is_deleted", sa.Boolean(), server_default=sa.text("false"), nullable=False),
        sa.Column("deleted_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("deleted_by", sa.UUID(), nullable=True),
        sa.Column("version", sa.Integer(), server_default=sa.text("1"), nullable=False),
        sa.ForeignKeyConstraint(
            ["tenant_id"], ["foundation.sec_tenant.id"], ondelete="RESTRICT"
        ),
        sa.ForeignKeyConstraint(
            ["company_id"], ["organization.org_company.id"], ondelete="RESTRICT"
        ),
        sa.ForeignKeyConstraint(
            ["branch_id"], ["organization.org_branch.id"], ondelete="RESTRICT"
        ),
        sa.ForeignKeyConstraint(
            ["dispatch_id"],
            ["procurement.proc_vendor_dispatch.id"],
            ondelete="RESTRICT",
        ),
        sa.ForeignKeyConstraint(
            ["order_line_id"],
            ["procurement.proc_order_line.id"],
            ondelete="RESTRICT",
        ),
        sa.PrimaryKeyConstraint("id"),
        sa.UniqueConstraint(
            "dispatch_id",
            "order_line_id",
            name="uk_proc_vdl_dispatch_line",
        ),
        sa.CheckConstraint("dispatch_qty > 0", name="ck_proc_vdl_qty"),
        schema="procurement",
    )
    op.create_index(
        "ix_proc_vendor_dispatch_line_dispatch_id",
        "proc_vendor_dispatch_line",
        ["dispatch_id"],
        unique=False,
        schema="procurement",
    )
    op.create_index(
        "ix_proc_vendor_dispatch_line_order_line_id",
        "proc_vendor_dispatch_line",
        ["order_line_id"],
        unique=False,
        schema="procurement",
    )


def downgrade() -> None:
    op.drop_table("proc_vendor_dispatch_line", schema="procurement")
    op.drop_table("proc_vendor_dispatch", schema="procurement")
    op.drop_index(
        "ix_proc_oh_fulfillment_stage",
        table_name="proc_order_header",
        schema="procurement",
    )
    op.drop_constraint(
        "ck_proc_oh_vendor_response_status",
        "proc_order_header",
        schema="procurement",
        type_="check",
    )
    op.drop_constraint(
        "ck_proc_oh_fulfillment_stage",
        "proc_order_header",
        schema="procurement",
        type_="check",
    )
    for col in (
        "customer_delivery_meta",
        "customer_pod_uploaded_at",
        "customer_dispatch_shared_at",
        "customer_order_processed_sent_at",
        "po_sent_to_vendor_at",
        "customer_promised_delivery_date",
        "vendor_responded_at",
        "vendor_response_remark",
        "vendor_response_status",
        "fulfillment_stage",
    ):
        op.drop_column("proc_order_header", col, schema="procurement")
