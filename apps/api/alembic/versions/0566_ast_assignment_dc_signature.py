"""Sub-phase 4D: delivery challan signature status on ast_asset_assignment."""

from collections.abc import Sequence

import sqlalchemy as sa
from alembic import op

revision: str = "0566_ast_assignment_dc_signature"
down_revision: str | None = "0565_ast_assignment_component"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    op.add_column(
        "ast_asset_assignment",
        sa.Column(
            "delivery_challan_signature_status",
            sa.String(length=30),
            nullable=False,
            server_default="not_signed",
        ),
        schema="asset",
    )
    op.create_check_constraint(
        "ck_ast_asset_assignment_dc_signature_status",
        "ast_asset_assignment",
        "delivery_challan_signature_status IN ('not_signed','signed')",
        schema="asset",
    )
    op.create_index(
        "ix_ast_asset_assignment_dc_signature_status",
        "ast_asset_assignment",
        ["delivery_challan_signature_status"],
        unique=False,
        schema="asset",
    )
    # Explicit backfill for clarity (server_default already covers new reads).
    op.execute(
        sa.text(
            "UPDATE asset.ast_asset_assignment "
            "SET delivery_challan_signature_status = 'not_signed' "
            "WHERE delivery_challan_signature_status IS NULL "
            "OR delivery_challan_signature_status = ''"
        )
    )


def downgrade() -> None:
    op.drop_index(
        "ix_ast_asset_assignment_dc_signature_status",
        table_name="ast_asset_assignment",
        schema="asset",
    )
    op.drop_constraint(
        "ck_ast_asset_assignment_dc_signature_status",
        "ast_asset_assignment",
        schema="asset",
        type_="check",
    )
    op.drop_column(
        "ast_asset_assignment",
        "delivery_challan_signature_status",
        schema="asset",
    )
