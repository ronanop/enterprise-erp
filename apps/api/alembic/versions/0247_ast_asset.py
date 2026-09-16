"""Create AstAsset table.

Uses an explicit create for the historical column set. Later revisions add
asset_domain (0571), asset_type_id (0577), operational_status (0559), and
discovery_profile_json (0558). Creating from the current ORM model would
fail on a fresh database because those FKs/columns land too early.
"""

from collections.abc import Sequence

import sqlalchemy as sa
from alembic import op
from sqlalchemy.dialects import postgresql

revision: str = "0247_ast_asset"
down_revision: str | None = "0246_ast_asset_category"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    conn = op.get_bind()
    exists = conn.execute(
        sa.text(
            """
            SELECT 1
            FROM information_schema.tables
            WHERE table_schema = 'asset' AND table_name = 'ast_asset'
            """
        )
    ).first()
    if exists:
        return

    op.create_table(
        "ast_asset",
        sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True, nullable=False),
        sa.Column("document_number", sa.String(50), nullable=False),
        sa.Column("asset_code", sa.String(50), nullable=False),
        sa.Column("asset_name", sa.String(255), nullable=False),
        sa.Column("asset_category_id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("asset_type", sa.String(40), nullable=False),
        sa.Column("master_asset_id", postgresql.UUID(as_uuid=True), nullable=True),
        sa.Column("product_id", postgresql.UUID(as_uuid=True), nullable=True),
        sa.Column("supplier_vendor_id", postgresql.UUID(as_uuid=True), nullable=True),
        sa.Column("serial_number", sa.String(100), nullable=True),
        sa.Column("barcode", sa.String(100), nullable=True),
        sa.Column("qr_code", sa.String(100), nullable=True),
        sa.Column("rfid_tag", sa.String(100), nullable=True),
        sa.Column("make", sa.String(100), nullable=True),
        sa.Column("model", sa.String(100), nullable=True),
        sa.Column("configuration", sa.String(500), nullable=True),
        sa.Column("purchase_date", sa.Date(), nullable=True),
        sa.Column("purchase_cost", sa.Numeric(18, 4), nullable=True),
        sa.Column("current_book_value", sa.Numeric(18, 4), nullable=True),
        sa.Column("salvage_value", sa.Numeric(18, 4), nullable=True),
        sa.Column("currency_code", sa.String(10), nullable=False),
        sa.Column("depreciation_method", sa.String(40), nullable=True),
        sa.Column("useful_life_months", sa.Integer(), nullable=True),
        sa.Column("department_id", postgresql.UUID(as_uuid=True), nullable=True),
        sa.Column("custodian_employee_id", postgresql.UUID(as_uuid=True), nullable=True),
        sa.Column("purchase_order_id", postgresql.UUID(as_uuid=True), nullable=True),
        sa.Column("grn_id", postgresql.UUID(as_uuid=True), nullable=True),
        sa.Column("inventory_receipt_id", postgresql.UUID(as_uuid=True), nullable=True),
        sa.Column("inventory_issue_id", postgresql.UUID(as_uuid=True), nullable=True),
        sa.Column("project_id", postgresql.UUID(as_uuid=True), nullable=True),
        sa.Column("production_order_id", postgresql.UUID(as_uuid=True), nullable=True),
        sa.Column("quality_inspection_id", postgresql.UUID(as_uuid=True), nullable=True),
        sa.Column("is_shared", sa.Boolean(), nullable=False),
        sa.Column("status", sa.String(30), nullable=False),
        sa.Column("workflow_status", sa.String(30), nullable=True),
        sa.Column("workflow_instance_id", postgresql.UUID(as_uuid=True), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.text("now()"), nullable=False),
        sa.Column("created_by", postgresql.UUID(as_uuid=True), nullable=True),
        sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.text("now()"), nullable=False),
        sa.Column("updated_by", postgresql.UUID(as_uuid=True), nullable=True),
        sa.Column("tenant_id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("company_id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("branch_id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("is_deleted", sa.Boolean(), server_default=sa.text("false"), nullable=False),
        sa.Column("deleted_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("deleted_by", postgresql.UUID(as_uuid=True), nullable=True),
        sa.Column("version", sa.Integer(), server_default=sa.text("1"), nullable=False),
        sa.UniqueConstraint("company_id", "asset_code", name="uk_ast_asset_company_code"),
        sa.CheckConstraint(
            "asset_type IN ('fixed','consumable','digital','leased')",
            name="ck_ast_asset_type",
        ),
        sa.CheckConstraint(
            "depreciation_method IS NULL OR depreciation_method IN "
            "('straight_line','wdv','units_of_production')",
            name="ck_ast_asset_depr_method",
        ),
        sa.CheckConstraint(
            "status IN ('draft','submitted','approved','active','in_maintenance',"
            "'transferred','disposed','written_off','cancelled')",
            name="ck_ast_asset_status",
        ),
        sa.CheckConstraint(
            "purchase_cost IS NULL OR purchase_cost >= 0",
            name="ck_ast_asset_purchase_cost",
        ),
        sa.ForeignKeyConstraint(
            ["asset_category_id"],
            ["asset.ast_asset_category.id"],
            ondelete="RESTRICT",
        ),
        sa.ForeignKeyConstraint(
            ["master_asset_id"],
            ["master.master_asset.id"],
            ondelete="RESTRICT",
        ),
        sa.ForeignKeyConstraint(
            ["product_id"],
            ["master.master_product.id"],
            ondelete="RESTRICT",
        ),
        sa.ForeignKeyConstraint(
            ["supplier_vendor_id"],
            ["master.master_vendor.id"],
            ondelete="RESTRICT",
        ),
        sa.ForeignKeyConstraint(
            ["department_id"],
            ["organization.org_department.id"],
            ondelete="RESTRICT",
        ),
        sa.ForeignKeyConstraint(
            ["custodian_employee_id"],
            ["master.master_employee.id"],
            ondelete="RESTRICT",
        ),
        sa.ForeignKeyConstraint(
            ["workflow_instance_id"],
            ["foundation.wf_instance.id"],
            ondelete="SET NULL",
        ),
        sa.ForeignKeyConstraint(
            ["tenant_id"],
            ["foundation.sec_tenant.id"],
            ondelete="RESTRICT",
        ),
        sa.ForeignKeyConstraint(
            ["company_id"],
            ["organization.org_company.id"],
            ondelete="RESTRICT",
        ),
        sa.ForeignKeyConstraint(
            ["branch_id"],
            ["organization.org_branch.id"],
            ondelete="RESTRICT",
        ),
        schema="asset",
    )
    op.create_index("ix_ast_asset_asset_category_id", "ast_asset", ["asset_category_id"], schema="asset")
    op.create_index("ix_ast_asset_master_asset_id", "ast_asset", ["master_asset_id"], schema="asset")
    op.create_index("ix_ast_asset_product_id", "ast_asset", ["product_id"], schema="asset")
    op.create_index("ix_ast_asset_supplier_vendor_id", "ast_asset", ["supplier_vendor_id"], schema="asset")
    op.create_index("ix_ast_asset_department_id", "ast_asset", ["department_id"], schema="asset")
    op.create_index(
        "ix_ast_asset_custodian_employee_id",
        "ast_asset",
        ["custodian_employee_id"],
        schema="asset",
    )
    op.create_index("ix_ast_asset_status", "ast_asset", ["status"], schema="asset")


def downgrade() -> None:
    op.drop_table("ast_asset", schema="asset")
