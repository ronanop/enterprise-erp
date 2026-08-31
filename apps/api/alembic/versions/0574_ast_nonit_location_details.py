"""Additive Non-IT location detail columns (kind, code, building, floor, remarks).

Does not alter IT tables.
"""

from collections.abc import Sequence

import sqlalchemy as sa
from alembic import op

revision: str = "0574_ast_nonit_location_details"
down_revision: str | None = "0573_ast_nonit_maintenance_disposal"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None

KIND_VALUES = (
    "CONFERENCE_ROOM",
    "MEETING_ROOM",
    "DEPARTMENT",
    "FLOOR",
    "CABIN",
    "LOBBY",
    "CAFETERIA",
    "COMMON_AREA",
    "WAREHOUSE",
    "PARKING",
    "OTHER",
)


def upgrade() -> None:
    op.add_column(
        "ast_nonit_location",
        sa.Column(
            "location_kind",
            sa.String(40),
            nullable=False,
            server_default="OTHER",
        ),
        schema="asset",
    )
    op.add_column(
        "ast_nonit_location",
        sa.Column("code", sa.String(40), nullable=True),
        schema="asset",
    )
    op.add_column(
        "ast_nonit_location",
        sa.Column("building", sa.String(120), nullable=True),
        schema="asset",
    )
    op.add_column(
        "ast_nonit_location",
        sa.Column("floor", sa.String(40), nullable=True),
        schema="asset",
    )
    op.add_column(
        "ast_nonit_location",
        sa.Column("remarks", sa.Text(), nullable=True),
        schema="asset",
    )
    op.create_check_constraint(
        "ck_ast_nonit_location_kind",
        "ast_nonit_location",
        "location_kind IN (" + ",".join(f"'{v}'" for v in KIND_VALUES) + ")",
        schema="asset",
    )


def downgrade() -> None:
    op.drop_constraint(
        "ck_ast_nonit_location_kind",
        "ast_nonit_location",
        schema="asset",
        type_="check",
    )
    op.drop_column("ast_nonit_location", "remarks", schema="asset")
    op.drop_column("ast_nonit_location", "floor", schema="asset")
    op.drop_column("ast_nonit_location", "building", schema="asset")
    op.drop_column("ast_nonit_location", "code", schema="asset")
    op.drop_column("ast_nonit_location", "location_kind", schema="asset")
