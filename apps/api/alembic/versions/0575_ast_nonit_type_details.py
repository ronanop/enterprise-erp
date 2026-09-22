"""Additive Non-IT asset type category + description columns.

Does not alter IT tables.
"""

from collections.abc import Sequence

import sqlalchemy as sa
from alembic import op

revision: str = "0575_ast_nonit_type_details"
down_revision: str | None = "0574_ast_nonit_location_details"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None

CATEGORY_VALUES = (
    "FURNITURE",
    "APPLIANCE",
    "ELECTRONICS",
    "FIXTURE",
    "EQUIPMENT",
    "STORAGE",
    "OTHER",
)


def upgrade() -> None:
    op.add_column(
        "ast_nonit_asset_type",
        sa.Column(
            "category",
            sa.String(40),
            nullable=False,
            server_default="OTHER",
        ),
        schema="asset",
    )
    op.add_column(
        "ast_nonit_asset_type",
        sa.Column("description", sa.Text(), nullable=True),
        schema="asset",
    )
    op.create_check_constraint(
        "ck_ast_nonit_asset_type_category",
        "ast_nonit_asset_type",
        "category IN (" + ",".join(f"'{v}'" for v in CATEGORY_VALUES) + ")",
        schema="asset",
    )
    # Best-effort backfill for seeded defaults
    conn = op.get_bind()
    for name, category in (
        ("Chair", "FURNITURE"),
        ("Table-Desk", "FURNITURE"),
        ("AC", "APPLIANCE"),
        ("LED TV", "ELECTRONICS"),
    ):
        conn.execute(
            sa.text(
                """
                UPDATE asset.ast_nonit_asset_type
                SET category = :category
                WHERE lower(name) = lower(:name)
                """
            ),
            {"category": category, "name": name},
        )


def downgrade() -> None:
    op.drop_constraint(
        "ck_ast_nonit_asset_type_category",
        "ast_nonit_asset_type",
        schema="asset",
        type_="check",
    )
    op.drop_column("ast_nonit_asset_type", "description", schema="asset")
    op.drop_column("ast_nonit_asset_type", "category", schema="asset")
