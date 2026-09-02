"""Add five site delivery scopes and migrate legacy type_1/2/3."""

from collections.abc import Sequence

import sqlalchemy as sa
from alembic import op

revision: str = "0461_site_delivery_scopes"
down_revision: str | None = "0460_prj_site_flow_fields"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None

TABLE = "prj_site_installation"
SCHEMA = "project"


def upgrade() -> None:
    op.drop_constraint("ck_prj_site_delivery_type", TABLE, schema=SCHEMA, type_="check")
    op.execute(
        sa.text(
            f"""
            UPDATE {SCHEMA}.{TABLE}
            SET delivery_type = CASE delivery_type
                WHEN 'type_1' THEN 'server_bios_rack'
                WHEN 'type_2' THEN 'server_os_rack'
                WHEN 'type_3' THEN 'rack_only'
                ELSE delivery_type
            END
            """
        )
    )
    op.alter_column(
        TABLE,
        "delivery_type",
        existing_type=sa.String(length=20),
        type_=sa.String(length=40),
        existing_nullable=False,
        schema=SCHEMA,
    )
    op.create_check_constraint(
        "ck_prj_site_delivery_type",
        TABLE,
        "delivery_type IN ("
        "'server_os_rack',"
        "'server_os',"
        "'server_bios_rack',"
        "'rack_only',"
        "'server_bios'"
        ")",
        schema=SCHEMA,
    )


def downgrade() -> None:
    op.drop_constraint("ck_prj_site_delivery_type", TABLE, schema=SCHEMA, type_="check")
    op.execute(
        sa.text(
            f"""
            UPDATE {SCHEMA}.{TABLE}
            SET delivery_type = CASE delivery_type
                WHEN 'server_bios_rack' THEN 'type_1'
                WHEN 'server_os_rack' THEN 'type_2'
                WHEN 'server_os' THEN 'type_2'
                WHEN 'rack_only' THEN 'type_3'
                WHEN 'server_bios' THEN 'type_1'
                ELSE 'type_1'
            END
            """
        )
    )
    op.alter_column(
        TABLE,
        "delivery_type",
        existing_type=sa.String(length=40),
        type_=sa.String(length=20),
        existing_nullable=False,
        schema=SCHEMA,
    )
    op.create_check_constraint(
        "ck_prj_site_delivery_type",
        TABLE,
        "delivery_type IN ('type_1','type_2','type_3')",
        schema=SCHEMA,
    )
