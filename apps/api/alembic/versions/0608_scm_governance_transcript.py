"""SCM governance review: PO validation chain, negotiation savings, invoice/payment tracking.

Adds the schema behind the management review of the order-to-cash flow:

* Customer PO is validated by Finance (tax/GST) and Legal (terms & conditions)
  before it reaches Management, so Sales never owns terms validation.
* Supply-chain negotiation savings are captured on the vendor PO and the vendor
  PO cannot be issued to the distributor until Management approves the
  post-negotiation price.
* Customer invoices are routed by HSN (physical/warehouse) vs SAC (customer
  portal) and the portal submission + payment dates are tracked for AR.
* Site delivery closes with a signed customer completion certificate.
"""

from collections.abc import Sequence

import sqlalchemy as sa
from alembic import op
from sqlalchemy.dialects import postgresql

revision: str = "0608_scm_governance_transcript"
down_revision: str | Sequence[str] | None = "0607_merge_ast_org_heads"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


_PO_STAGE_STATUSES = "('not_required','pending','approved','rejected')"


def upgrade() -> None:
    # --- CRM: customer PO validation chain -------------------------------
    for column, ddl_type in (
        ("po_finance_status", sa.String(20)),
        ("po_terms_status", sa.String(20)),
    ):
        op.add_column(
            "crm_opportunity",
            sa.Column(
                column,
                ddl_type,
                nullable=False,
                server_default="not_required",
            ),
            schema="crm",
        )
    op.add_column("crm_opportunity", sa.Column("po_finance_remark", sa.Text(), nullable=True), schema="crm")
    op.add_column("crm_opportunity", sa.Column("po_terms_remark", sa.Text(), nullable=True), schema="crm")
    for column in ("po_finance_by", "po_terms_by"):
        op.add_column(
            "crm_opportunity",
            sa.Column(column, postgresql.UUID(as_uuid=True), nullable=True),
            schema="crm",
        )
    for column in ("po_finance_at", "po_terms_at"):
        op.add_column(
            "crm_opportunity",
            sa.Column(column, sa.DateTime(timezone=True), nullable=True),
            schema="crm",
        )
    op.add_column(
        "crm_opportunity",
        sa.Column("po_approval_chain", postgresql.JSONB(astext_type=sa.Text()), nullable=True),
        schema="crm",
    )
    op.create_check_constraint(
        "ck_crm_opp_po_finance_status",
        "crm_opportunity",
        f"po_finance_status IN {_PO_STAGE_STATUSES}",
        schema="crm",
    )
    op.create_check_constraint(
        "ck_crm_opp_po_terms_status",
        "crm_opportunity",
        f"po_terms_status IN {_PO_STAGE_STATUSES}",
        schema="crm",
    )

    # My Jobs gains a Legal team for terms & conditions validation.
    op.drop_constraint("ck_crm_approval_task_team_role", "crm_approval_task", schema="crm")
    op.create_check_constraint(
        "ck_crm_approval_task_team_role",
        "crm_approval_task",
        "team_role IN ('presales','project','management','accounts','scm','legal')",
        schema="crm",
    )

    # --- CRM OVF: SCM savings (hidden from Sales) + invoice / payment -----
    op.add_column(
        "crm_ovf",
        sa.Column(
            "scm_savings_amount",
            sa.Numeric(18, 4),
            nullable=False,
            server_default="0",
        ),
        schema="crm",
    )
    op.add_column(
        "crm_ovf",
        sa.Column("scm_negotiated_vendor_total", sa.Numeric(18, 4), nullable=True),
        schema="crm",
    )
    op.add_column("crm_ovf", sa.Column("invoice_channel", sa.String(20), nullable=True), schema="crm")
    op.add_column(
        "crm_ovf",
        sa.Column(
            "invoice_submitted_portal",
            sa.Boolean(),
            nullable=False,
            server_default="false",
        ),
        schema="crm",
    )
    op.add_column(
        "crm_ovf",
        sa.Column("invoice_submitted_at", sa.DateTime(timezone=True), nullable=True),
        schema="crm",
    )
    op.add_column(
        "crm_ovf",
        sa.Column("invoice_submitted_by", postgresql.UUID(as_uuid=True), nullable=True),
        schema="crm",
    )
    op.add_column("crm_ovf", sa.Column("invoice_reference", sa.String(100), nullable=True), schema="crm")
    op.add_column("crm_ovf", sa.Column("payment_due_date", sa.Date(), nullable=True), schema="crm")
    op.add_column("crm_ovf", sa.Column("payment_received_date", sa.Date(), nullable=True), schema="crm")
    op.add_column("crm_ovf", sa.Column("payment_delay_reason", sa.Text(), nullable=True), schema="crm")
    op.create_check_constraint(
        "ck_crm_ovf_invoice_channel",
        "crm_ovf",
        "invoice_channel IS NULL OR invoice_channel IN ('portal','physical','mixed')",
        schema="crm",
    )

    # --- Procurement: negotiation savings + management issue gate ---------
    for column in ("baseline_amount", "negotiated_savings_amount"):
        op.add_column(
            "proc_order_header",
            sa.Column(column, sa.Numeric(18, 4), nullable=False, server_default="0"),
            schema="procurement",
        )
    op.add_column(
        "proc_order_header",
        sa.Column(
            "negotiation_status",
            sa.String(20),
            nullable=False,
            server_default="not_required",
        ),
        schema="procurement",
    )
    op.add_column(
        "proc_order_header",
        sa.Column("negotiation_remark", sa.Text(), nullable=True),
        schema="procurement",
    )
    for column in ("negotiation_submitted_at", "negotiation_decided_at"):
        op.add_column(
            "proc_order_header",
            sa.Column(column, sa.DateTime(timezone=True), nullable=True),
            schema="procurement",
        )
    for column in ("negotiation_submitted_by", "negotiation_decided_by"):
        op.add_column(
            "proc_order_header",
            sa.Column(column, postgresql.UUID(as_uuid=True), nullable=True),
            schema="procurement",
        )
    op.add_column(
        "proc_order_header",
        sa.Column("negotiation_decided_by_name", sa.String(255), nullable=True),
        schema="procurement",
    )
    op.create_check_constraint(
        "ck_proc_oh_negotiation_status",
        "proc_order_header",
        f"negotiation_status IN {_PO_STAGE_STATUSES}",
        schema="procurement",
    )

    # --- Projects: signed customer completion certificate -----------------
    op.add_column(
        "prj_site_installation",
        sa.Column("completion_certificate_number", sa.String(60), nullable=True),
        schema="project",
    )
    op.add_column(
        "prj_site_installation",
        sa.Column("completion_certificate_issued_at", sa.DateTime(timezone=True), nullable=True),
        schema="project",
    )
    op.add_column(
        "prj_site_installation",
        sa.Column(
            "completion_certificate_signed",
            sa.Boolean(),
            nullable=False,
            server_default="false",
        ),
        schema="project",
    )
    op.add_column(
        "prj_site_installation",
        sa.Column("completion_certificate_signed_date", sa.Date(), nullable=True),
        schema="project",
    )
    op.add_column(
        "prj_site_installation",
        sa.Column("completion_certificate_signatory", sa.String(255), nullable=True),
        schema="project",
    )
    op.add_column(
        "prj_site_installation",
        sa.Column("completion_certificate_attachment_name", sa.String(255), nullable=True),
        schema="project",
    )


def downgrade() -> None:
    for column in (
        "completion_certificate_attachment_name",
        "completion_certificate_signatory",
        "completion_certificate_signed_date",
        "completion_certificate_signed",
        "completion_certificate_issued_at",
        "completion_certificate_number",
    ):
        op.drop_column("prj_site_installation", column, schema="project")

    op.drop_constraint("ck_proc_oh_negotiation_status", "proc_order_header", schema="procurement")
    for column in (
        "negotiation_decided_by_name",
        "negotiation_decided_by",
        "negotiation_submitted_by",
        "negotiation_decided_at",
        "negotiation_submitted_at",
        "negotiation_remark",
        "negotiation_status",
        "negotiated_savings_amount",
        "baseline_amount",
    ):
        op.drop_column("proc_order_header", column, schema="procurement")

    op.drop_constraint("ck_crm_ovf_invoice_channel", "crm_ovf", schema="crm")
    for column in (
        "payment_delay_reason",
        "payment_received_date",
        "payment_due_date",
        "invoice_reference",
        "invoice_submitted_by",
        "invoice_submitted_at",
        "invoice_submitted_portal",
        "invoice_channel",
        "scm_negotiated_vendor_total",
        "scm_savings_amount",
    ):
        op.drop_column("crm_ovf", column, schema="crm")

    op.drop_constraint("ck_crm_approval_task_team_role", "crm_approval_task", schema="crm")
    op.create_check_constraint(
        "ck_crm_approval_task_team_role",
        "crm_approval_task",
        "team_role IN ('presales','project','management','accounts','scm')",
        schema="crm",
    )

    op.drop_constraint("ck_crm_opp_po_terms_status", "crm_opportunity", schema="crm")
    op.drop_constraint("ck_crm_opp_po_finance_status", "crm_opportunity", schema="crm")
    for column in (
        "po_approval_chain",
        "po_terms_at",
        "po_finance_at",
        "po_terms_by",
        "po_finance_by",
        "po_terms_remark",
        "po_finance_remark",
        "po_terms_status",
        "po_finance_status",
    ):
        op.drop_column("crm_opportunity", column, schema="crm")
