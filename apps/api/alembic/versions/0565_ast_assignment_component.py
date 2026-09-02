"""Sub-phase 4C: component_type on ast_asset_component + ast_assignment_component."""

from collections.abc import Sequence

import sqlalchemy as sa
from alembic import op
from sqlalchemy.dialects import postgresql

revision: str = "0565_ast_assignment_component"
down_revision: str | None = "0564_ast_asset_registration_attrs"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    op.add_column(
        "ast_asset_component",
        sa.Column(
            "component_type",
            sa.String(length=30),
            nullable=False,
            server_default="OTHER",
        ),
        schema="asset",
    )
    op.create_check_constraint(
        "ck_ast_asset_component_type",
        "ast_asset_component",
        "component_type IN ("
        "'CHARGER','MOUSE','KEYBOARD','CABLE','PENDRIVE','LAPTOP_BAG','OTHER'"
        ")",
        schema="asset",
    )
    op.create_index(
        "ix_ast_asset_component_component_type",
        "ast_asset_component",
        ["component_type"],
        unique=False,
        schema="asset",
    )
    # Existing rows: server_default already backfills OTHER; keep explicit for clarity.
    op.execute(
        sa.text(
            "UPDATE asset.ast_asset_component "
            "SET component_type = 'OTHER' "
            "WHERE component_type IS NULL OR component_type = ''"
        )
    )

    op.create_table(
        "ast_assignment_component",
        sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True, nullable=False),
        sa.Column("tenant_id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("company_id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("created_by", postgresql.UUID(as_uuid=True), nullable=True),
        sa.Column("updated_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("updated_by", postgresql.UUID(as_uuid=True), nullable=True),
        sa.Column("is_deleted", sa.Boolean(), nullable=False, server_default=sa.text("false")),
        sa.Column("deleted_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("deleted_by", postgresql.UUID(as_uuid=True), nullable=True),
        sa.Column("version", sa.Integer(), nullable=False, server_default=sa.text("1")),
        sa.Column("assignment_id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("component_id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column(
            "issue_status",
            sa.String(length=30),
            nullable=False,
            server_default="ISSUED",
        ),
        sa.Column("issued_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("returned_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("return_condition", sa.String(length=30), nullable=True),
        sa.Column("return_remarks", sa.Text(), nullable=True),
        sa.ForeignKeyConstraint(
            ["assignment_id"],
            ["asset.ast_asset_assignment.id"],
            ondelete="RESTRICT",
        ),
        sa.ForeignKeyConstraint(
            ["component_id"],
            ["asset.ast_asset_component.id"],
            ondelete="RESTRICT",
        ),
        sa.CheckConstraint(
            "issue_status IN ('ISSUED','RETURNED','MISSING','DAMAGED','RETAINED')",
            name="ck_ast_assignment_component_issue_status",
        ),
        schema="asset",
    )
    op.create_index(
        "ix_ast_assignment_component_assignment_id",
        "ast_assignment_component",
        ["assignment_id"],
        unique=False,
        schema="asset",
    )
    op.create_index(
        "ix_ast_assignment_component_component_id",
        "ast_assignment_component",
        ["component_id"],
        unique=False,
        schema="asset",
    )
    op.create_index(
        "ix_ast_assignment_component_issue_status",
        "ast_assignment_component",
        ["issue_status"],
        unique=False,
        schema="asset",
    )
    op.create_index(
        "ix_ast_assignment_component_company_id",
        "ast_assignment_component",
        ["company_id"],
        unique=False,
        schema="asset",
    )
    op.create_index(
        "ix_ast_assignment_component_tenant_id",
        "ast_assignment_component",
        ["tenant_id"],
        unique=False,
        schema="asset",
    )
    op.execute(
        sa.text(
            "CREATE UNIQUE INDEX uq_ast_assignment_component_active_issue "
            "ON asset.ast_assignment_component (component_id) "
            "WHERE issue_status = 'ISSUED' AND is_deleted = false"
        )
    )


def downgrade() -> None:
    op.execute(sa.text("DROP INDEX IF EXISTS asset.uq_ast_assignment_component_active_issue"))
    op.drop_table("ast_assignment_component", schema="asset")
    op.drop_index(
        "ix_ast_asset_component_component_type",
        table_name="ast_asset_component",
        schema="asset",
    )
    op.drop_constraint(
        "ck_ast_asset_component_type",
        "ast_asset_component",
        schema="asset",
        type_="check",
    )
    op.drop_column("ast_asset_component", "component_type", schema="asset")
