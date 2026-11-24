"""Create AstAssetLocation table.

Historical shape only — location_id / building_id are added later by
0505_ast_location_master / 0576_ast_location_master. Do not create from the
current ORM model (it already includes those FKs).
"""

from collections.abc import Sequence

import sqlalchemy as sa
from alembic import op

revision: str = "0251_ast_asset_location"
down_revision: str | None = "0250_ast_asset_transfer"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    op.create_table(
        "ast_asset_location",
        sa.Column("id", sa.Uuid(), nullable=False),
        sa.Column("branch_id", sa.Uuid(), nullable=True),
        sa.Column("asset_id", sa.Uuid(), nullable=False),
        sa.Column("location_label", sa.String(length=255), nullable=False),
        sa.Column("org_location_id", sa.Uuid(), nullable=True),
        sa.Column("effective_from", sa.DateTime(timezone=True), nullable=True),
        sa.Column("effective_to", sa.DateTime(timezone=True), nullable=True),
        sa.Column("is_current", sa.Boolean(), nullable=False),
        sa.Column("status", sa.String(length=30), nullable=False),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.text("now()"), nullable=False),
        sa.Column("created_by", sa.Uuid(), nullable=True),
        sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.text("now()"), nullable=False),
        sa.Column("updated_by", sa.Uuid(), nullable=True),
        sa.Column("tenant_id", sa.Uuid(), nullable=False),
        sa.Column("company_id", sa.Uuid(), nullable=False),
        sa.Column("is_deleted", sa.Boolean(), server_default=sa.text("false"), nullable=False),
        sa.Column("deleted_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("deleted_by", sa.Uuid(), nullable=True),
        sa.Column("version", sa.Integer(), server_default=sa.text("1"), nullable=False),
        sa.CheckConstraint("status IN ('active','historical')", name="ck_ast_asset_location_status"),
        sa.ForeignKeyConstraint(["asset_id"], ["asset.ast_asset.id"], ondelete="RESTRICT"),
        sa.ForeignKeyConstraint(["branch_id"], ["organization.org_branch.id"], ondelete="RESTRICT"),
        sa.ForeignKeyConstraint(["company_id"], ["organization.org_company.id"], ondelete="RESTRICT"),
        sa.ForeignKeyConstraint(["tenant_id"], ["foundation.sec_tenant.id"], ondelete="RESTRICT"),
        sa.PrimaryKeyConstraint("id"),
        schema="asset",
    )
    op.create_index(
        op.f("ix_asset_ast_asset_location_asset_id"),
        "ast_asset_location",
        ["asset_id"],
        unique=False,
        schema="asset",
    )
    op.create_index(
        op.f("ix_asset_ast_asset_location_branch_id"),
        "ast_asset_location",
        ["branch_id"],
        unique=False,
        schema="asset",
    )
    op.create_index(
        op.f("ix_asset_ast_asset_location_company_id"),
        "ast_asset_location",
        ["company_id"],
        unique=False,
        schema="asset",
    )
    op.create_index(
        op.f("ix_asset_ast_asset_location_is_current"),
        "ast_asset_location",
        ["is_current"],
        unique=False,
        schema="asset",
    )
    op.create_index(
        op.f("ix_asset_ast_asset_location_status"),
        "ast_asset_location",
        ["status"],
        unique=False,
        schema="asset",
    )
    op.create_index(
        op.f("ix_asset_ast_asset_location_tenant_id"),
        "ast_asset_location",
        ["tenant_id"],
        unique=False,
        schema="asset",
    )


def downgrade() -> None:
    op.drop_index(op.f("ix_asset_ast_asset_location_tenant_id"), table_name="ast_asset_location", schema="asset")
    op.drop_index(op.f("ix_asset_ast_asset_location_status"), table_name="ast_asset_location", schema="asset")
    op.drop_index(op.f("ix_asset_ast_asset_location_is_current"), table_name="ast_asset_location", schema="asset")
    op.drop_index(op.f("ix_asset_ast_asset_location_company_id"), table_name="ast_asset_location", schema="asset")
    op.drop_index(op.f("ix_asset_ast_asset_location_branch_id"), table_name="ast_asset_location", schema="asset")
    op.drop_index(op.f("ix_asset_ast_asset_location_asset_id"), table_name="ast_asset_location", schema="asset")
    op.drop_table("ast_asset_location", schema="asset")
