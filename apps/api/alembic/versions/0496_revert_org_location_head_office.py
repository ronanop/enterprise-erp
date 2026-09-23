"""Revert L1 org_location head office changes (Phase R0).

Removes is_head_office and L1 uniqueness indexes introduced by 0495.
Pre-existing organization.org_location.city is unchanged.
"""

from collections.abc import Sequence

import sqlalchemy as sa
from alembic import op

revision: str = "0496_revert_org_location_head_office"
down_revision: str | None = "0495_org_location_head_office"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None

SCHEMA = "organization"
TABLE = "org_location"
HO_INDEX = "ux_org_location_company_head_office"
CITY_BLDG_INDEX = "ux_org_location_company_city_building"


def upgrade() -> None:
    op.execute(sa.text(f"DROP INDEX IF EXISTS {SCHEMA}.{CITY_BLDG_INDEX}"))
    op.drop_index(HO_INDEX, table_name=TABLE, schema=SCHEMA)
    op.drop_column(TABLE, "is_head_office", schema=SCHEMA)


def downgrade() -> None:
    op.add_column(
        TABLE,
        sa.Column(
            "is_head_office",
            sa.Boolean(),
            nullable=False,
            server_default=sa.text("false"),
        ),
        schema=SCHEMA,
    )

    op.create_index(
        HO_INDEX,
        TABLE,
        ["company_id"],
        unique=True,
        schema=SCHEMA,
        postgresql_where=sa.text("is_head_office = true AND is_deleted = false"),
    )

    op.execute(
        sa.text(
            f"""
            CREATE UNIQUE INDEX {CITY_BLDG_INDEX}
            ON {SCHEMA}.{TABLE} (
                company_id,
                lower(btrim(city)),
                lower(btrim(location_name))
            )
            WHERE is_deleted = false
              AND city IS NOT NULL
              AND btrim(city) <> ''
            """
        )
    )
