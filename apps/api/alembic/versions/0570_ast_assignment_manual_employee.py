"""Manual employee entry on assignments; DC challan deployed_to snapshot."""

from collections.abc import Sequence

import sqlalchemy as sa
from alembic import op

revision: str = "0570_ast_assignment_manual_employee"
down_revision: str | None = "0569_ast_dc_challan_document"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None

# Keep in sync with AstAssetAssignment.CK_AST_ASSET_ASSIGNMENT_EMPLOYEE_IDENTITY
_EMPLOYEE_IDENTITY_CHECK = (
    "("
    "("
    "allocation_type = 'employee' "
    "AND employee_source = 'MASTER_DATA' "
    "AND employee_id IS NOT NULL "
    "AND manual_employee_name IS NULL "
    "AND manual_employee_phone IS NULL "
    "AND manual_employee_email IS NULL "
    "AND manual_employee_deployed_to IS NULL"
    ") OR ("
    "allocation_type = 'employee' "
    "AND employee_source = 'MANUAL_ENTRY' "
    "AND employee_id IS NULL "
    "AND manual_employee_name IS NOT NULL AND trim(manual_employee_name) <> '' "
    "AND manual_employee_phone IS NOT NULL AND trim(manual_employee_phone) <> '' "
    "AND manual_employee_deployed_to IS NOT NULL AND trim(manual_employee_deployed_to) <> ''"
    ") OR ("
    "allocation_type <> 'employee' "
    "AND employee_id IS NULL "
    "AND employee_source IS NULL "
    "AND manual_employee_name IS NULL "
    "AND manual_employee_phone IS NULL "
    "AND manual_employee_email IS NULL "
    "AND manual_employee_deployed_to IS NULL"
    ")"
    ")"
)


def upgrade() -> None:
    op.add_column(
        "ast_asset_assignment",
        sa.Column("employee_source", sa.String(length=20), nullable=True),
        schema="asset",
    )
    op.add_column(
        "ast_asset_assignment",
        sa.Column("manual_employee_name", sa.String(length=255), nullable=True),
        schema="asset",
    )
    op.add_column(
        "ast_asset_assignment",
        sa.Column("manual_employee_phone", sa.String(length=30), nullable=True),
        schema="asset",
    )
    op.add_column(
        "ast_asset_assignment",
        sa.Column("manual_employee_email", sa.String(length=255), nullable=True),
        schema="asset",
    )
    op.add_column(
        "ast_asset_assignment",
        sa.Column("manual_employee_deployed_to", sa.String(length=255), nullable=True),
        schema="asset",
    )
    op.execute(
        sa.text(
            "UPDATE asset.ast_asset_assignment "
            "SET employee_source = 'MASTER_DATA' "
            "WHERE allocation_type = 'employee' "
            "AND employee_id IS NOT NULL "
            "AND employee_source IS NULL "
            "AND is_deleted = false"
        )
    )
    op.create_check_constraint(
        "ck_ast_asset_assignment_employee_source",
        "ast_asset_assignment",
        "employee_source IS NULL OR employee_source IN ('MASTER_DATA','MANUAL_ENTRY')",
        schema="asset",
    )
    op.create_check_constraint(
        "ck_ast_asset_assignment_employee_identity",
        "ast_asset_assignment",
        _EMPLOYEE_IDENTITY_CHECK,
        schema="asset",
    )

    op.add_column(
        "ast_dc_challan",
        sa.Column("deployed_to", sa.String(length=255), nullable=True),
        schema="asset",
    )


def downgrade() -> None:
    op.drop_column("ast_dc_challan", "deployed_to", schema="asset")
    op.drop_constraint(
        "ck_ast_asset_assignment_employee_identity",
        "ast_asset_assignment",
        schema="asset",
        type_="check",
    )
    op.drop_constraint(
        "ck_ast_asset_assignment_employee_source",
        "ast_asset_assignment",
        schema="asset",
        type_="check",
    )
    op.drop_column("ast_asset_assignment", "manual_employee_deployed_to", schema="asset")
    op.drop_column("ast_asset_assignment", "manual_employee_email", schema="asset")
    op.drop_column("ast_asset_assignment", "manual_employee_phone", schema="asset")
    op.drop_column("ast_asset_assignment", "manual_employee_name", schema="asset")
    op.drop_column("ast_asset_assignment", "employee_source", schema="asset")
