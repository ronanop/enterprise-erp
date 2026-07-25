"""Add Sales CRM (Zoho-replacement) tables and sales-process columns.

New tables: crm_company, crm_contact, crm_product, crm_quote, crm_quote_line,
crm_ovf, crm_ovf_line, crm_attachment, crm_approval_task, crm_state_history.

Altered tables: crm_lead (sales-lead extension columns, all nullable/defaulted
so legacy leads are untouched), crm_opportunity (blueprint / BOQ / SOW / deal
registration / OEM / customer-PO / margin columns, all nullable/defaulted so
legacy opportunities created via the old POST /crm/opportunities flow keep
working unchanged).
"""

import sys
from collections.abc import Sequence
from pathlib import Path

import sqlalchemy as sa
from alembic import op
from sqlalchemy.dialects.postgresql import UUID as PG_UUID

sys.path.insert(0, str(Path(__file__).resolve().parents[2] / "src"))

from modules.crm.models.approval_task import CrmApprovalTask  # noqa: F401,E402
from modules.crm.models.attachment import CrmAttachment  # noqa: F401,E402
from modules.crm.models.company import CrmCompany  # noqa: F401,E402
from modules.crm.models.contact import CrmContact  # noqa: F401,E402
from modules.crm.models.ovf import CrmOvf, CrmOvfLine  # noqa: F401,E402
from modules.crm.models.product import CrmProduct  # noqa: F401,E402
from modules.crm.models.quote import CrmQuote, CrmQuoteLine  # noqa: F401,E402
from modules.crm.models.state_history import CrmStateHistory  # noqa: F401,E402

revision: str = "0445_crm_sales_process"
down_revision: str | None = "0444_fin_fiscal_year_meta"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


LEAD_NEW_COLUMNS: list[sa.Column] = [
    sa.Column("company_account_id", PG_UUID(as_uuid=True), nullable=True),
    sa.Column("assigned_date", sa.Date(), nullable=True),
    sa.Column("expected_amount", sa.Numeric(18, 4), nullable=True),
    sa.Column("expected_closure_date", sa.Date(), nullable=True),
    sa.Column("salutation", sa.String(20), nullable=True),
    sa.Column("product_type", sa.String(30), nullable=True),
    sa.Column("sub_product_category", sa.String(100), nullable=True),
    sa.Column("sub_product", sa.String(100), nullable=True),
    sa.Column("sub_product_other", sa.String(100), nullable=True),
    sa.Column("engagement_score", sa.SmallInteger(), nullable=True),
    sa.Column("portal_link", sa.String(500), nullable=True),
    sa.Column("assign_to_id", PG_UUID(as_uuid=True), nullable=True),
    sa.Column("project_title", sa.String(255), nullable=True),
    sa.Column("requirement_type", sa.String(100), nullable=True),
    sa.Column("purchase_model", sa.String(100), nullable=True),
    sa.Column("dr_number", sa.String(100), nullable=True),
    sa.Column("new_dr_number", sa.String(100), nullable=True),
    sa.Column("deal_type", sa.String(50), nullable=True),
    sa.Column("street", sa.String(255), nullable=True),
    sa.Column("city", sa.String(100), nullable=True),
    sa.Column("state", sa.String(100), nullable=True),
    sa.Column("zip", sa.String(30), nullable=True),
    sa.Column("country", sa.String(100), nullable=True),
    sa.Column("oem_name", sa.String(150), nullable=True),
    sa.Column("oem_contact_person", sa.String(150), nullable=True),
    sa.Column("oem_contact_number", sa.String(30), nullable=True),
    sa.Column("oem_contact_email", sa.String(255), nullable=True),
    sa.Column("distributor_name", sa.String(150), nullable=True),
    sa.Column("distributor_contact", sa.String(150), nullable=True),
    sa.Column("end_customer_name", sa.String(255), nullable=True),
    sa.Column("end_customer_location", sa.String(255), nullable=True),
    sa.Column("entity_name", sa.String(255), nullable=True),
    sa.Column("entity_email", sa.String(255), nullable=True),
    sa.Column("entity_address", sa.Text(), nullable=True),
    sa.Column("entity_gst", sa.String(30), nullable=True),
    sa.Column("entity_contact", sa.String(100), nullable=True),
    sa.Column(
        "blueprint_state", sa.String(30), nullable=False, server_default="open"
    ),
    sa.Column("locked", sa.Boolean(), nullable=False, server_default=sa.text("false")),
    sa.Column("convert_remark", sa.Text(), nullable=True),
]

OPPORTUNITY_NEW_COLUMNS: list[sa.Column] = [
    sa.Column("company_account_id", PG_UUID(as_uuid=True), nullable=True),
    sa.Column("blueprint_state", sa.String(30), nullable=True),
    sa.Column("locked", sa.Boolean(), nullable=False, server_default=sa.text("false")),
    sa.Column("boq_attached", sa.Boolean(), nullable=False, server_default=sa.text("false")),
    sa.Column("boq_approved", sa.Boolean(), nullable=False, server_default=sa.text("false")),
    sa.Column("sow_attached", sa.Boolean(), nullable=False, server_default=sa.text("false")),
    sa.Column("sow_approved", sa.Boolean(), nullable=False, server_default=sa.text("false")),
    sa.Column("sow_skipped", sa.Boolean(), nullable=False, server_default=sa.text("false")),
    sa.Column("deal_reg_number", sa.String(100), nullable=True),
    sa.Column(
        "oem_quotation_received", sa.Boolean(), nullable=False, server_default=sa.text("false")
    ),
    sa.Column("oem_quote_attached", sa.Boolean(), nullable=False, server_default=sa.text("false")),
    sa.Column(
        "customer_po_attached", sa.Boolean(), nullable=False, server_default=sa.text("false")
    ),
    sa.Column(
        "customer_po_approved", sa.Boolean(), nullable=False, server_default=sa.text("false")
    ),
    sa.Column("deal_won_amount", sa.Numeric(18, 4), nullable=True),
    sa.Column("project_title", sa.String(255), nullable=True),
    sa.Column("has_hardware", sa.Boolean(), nullable=False, server_default=sa.text("false")),
    sa.Column("has_software", sa.Boolean(), nullable=False, server_default=sa.text("false")),
    sa.Column("has_services", sa.Boolean(), nullable=False, server_default=sa.text("false")),
]


def _existing_columns(table: str, schema: str) -> set[str]:
    bind = op.get_bind()
    insp = sa.inspect(bind)
    return {c["name"] for c in insp.get_columns(table, schema=schema)}


def _existing_fks(table: str, schema: str) -> set[str]:
    bind = op.get_bind()
    insp = sa.inspect(bind)
    return {fk.get("name") for fk in insp.get_foreign_keys(table, schema=schema) if fk.get("name")}


def upgrade() -> None:
    bind = op.get_bind()

    # 1. New standalone / catalog tables first.
    # crm_company may already exist from 0140 (FK prerequisite for CrmLead).
    CrmCompany.__table__.create(bind=bind, checkfirst=True)
    CrmContact.__table__.create(bind=bind, checkfirst=True)
    CrmProduct.__table__.create(bind=bind, checkfirst=True)

    # 2. Extend existing lead / opportunity tables (idempotent — columns may
    # already exist when ORM models include sales-process fields at 0140/0143).
    lead_cols = _existing_columns("crm_lead", "crm")
    for column in LEAD_NEW_COLUMNS:
        if column.name not in lead_cols:
            op.add_column("crm_lead", column.copy(), schema="crm")
    lead_fks = _existing_fks("crm_lead", "crm")
    if "fk_crm_lead_company_account" not in lead_fks:
        # Model-create path may already have attached an unnamed/autogen FK.
        has_company_fk = any(
            fk.get("referred_table") == "crm_company"
            and fk.get("constrained_columns") == ["company_account_id"]
            for fk in sa.inspect(bind).get_foreign_keys("crm_lead", schema="crm")
        )
        if not has_company_fk:
            op.create_foreign_key(
                "fk_crm_lead_company_account",
                "crm_lead",
                "crm_company",
                ["company_account_id"],
                ["id"],
                source_schema="crm",
                referent_schema="crm",
                ondelete="RESTRICT",
            )

    opp_cols = _existing_columns("crm_opportunity", "crm")
    for column in OPPORTUNITY_NEW_COLUMNS:
        if column.name not in opp_cols:
            op.add_column("crm_opportunity", column.copy(), schema="crm")
    opp_fks = _existing_fks("crm_opportunity", "crm")
    if "fk_crm_opportunity_company_account" not in opp_fks:
        has_company_fk = any(
            fk.get("referred_table") == "crm_company"
            and fk.get("constrained_columns") == ["company_account_id"]
            for fk in sa.inspect(bind).get_foreign_keys("crm_opportunity", schema="crm")
        )
        if not has_company_fk:
            op.create_foreign_key(
                "fk_crm_opportunity_company_account",
                "crm_opportunity",
                "crm_company",
                ["company_account_id"],
                ["id"],
                source_schema="crm",
                referent_schema="crm",
                ondelete="RESTRICT",
            )

    # 3. Quote / OVF (depend on opportunity + company + contact + product).
    CrmQuote.__table__.create(bind=bind, checkfirst=True)
    CrmQuoteLine.__table__.create(bind=bind, checkfirst=True)
    CrmOvf.__table__.create(bind=bind, checkfirst=True)
    CrmOvfLine.__table__.create(bind=bind, checkfirst=True)

    # 4. Generic support tables.
    CrmAttachment.__table__.create(bind=bind, checkfirst=True)
    CrmApprovalTask.__table__.create(bind=bind, checkfirst=True)
    CrmStateHistory.__table__.create(bind=bind, checkfirst=True)


def downgrade() -> None:
    bind = op.get_bind()

    CrmStateHistory.__table__.drop(bind=bind, checkfirst=True)
    CrmApprovalTask.__table__.drop(bind=bind, checkfirst=True)
    CrmAttachment.__table__.drop(bind=bind, checkfirst=True)

    CrmOvfLine.__table__.drop(bind=bind, checkfirst=True)
    CrmOvf.__table__.drop(bind=bind, checkfirst=True)
    CrmQuoteLine.__table__.drop(bind=bind, checkfirst=True)
    CrmQuote.__table__.drop(bind=bind, checkfirst=True)

    op.drop_constraint("fk_crm_opportunity_company_account", "crm_opportunity", schema="crm", type_="foreignkey")
    for column in reversed(OPPORTUNITY_NEW_COLUMNS):
        op.drop_column("crm_opportunity", column.name, schema="crm")

    op.drop_constraint("fk_crm_lead_company_account", "crm_lead", schema="crm", type_="foreignkey")
    for column in reversed(LEAD_NEW_COLUMNS):
        op.drop_column("crm_lead", column.name, schema="crm")

    CrmProduct.__table__.drop(bind=bind, checkfirst=True)
    CrmContact.__table__.drop(bind=bind, checkfirst=True)
    CrmCompany.__table__.drop(bind=bind, checkfirst=True)
