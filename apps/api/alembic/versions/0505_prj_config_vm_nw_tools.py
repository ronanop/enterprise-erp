"""Split firmware/N/W config; add VM installation and tools integration."""

from collections.abc import Sequence

import sqlalchemy as sa
from alembic import op

revision: str = "0505_prj_config_vm_nw_tools"
down_revision: str | Sequence[str] | None = "0504_prj_site_onsite_progress"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None

TABLE = "prj_site_installation"
SCHEMA = "project"


def upgrade() -> None:
    op.alter_column(
        TABLE,
        "firmware_nw_config_done",
        new_column_name="firmware_config_done",
        schema=SCHEMA,
    )
    op.alter_column(
        TABLE,
        "firmware_nw_config_date",
        new_column_name="firmware_config_date",
        schema=SCHEMA,
    )

    op.add_column(
        TABLE,
        sa.Column("nw_config_done", sa.Boolean(), nullable=False, server_default=sa.false()),
        schema=SCHEMA,
    )
    op.add_column(
        TABLE,
        sa.Column("nw_config_date", sa.Date(), nullable=True),
        schema=SCHEMA,
    )
    op.add_column(
        TABLE,
        sa.Column("vm_installation_done", sa.Boolean(), nullable=False, server_default=sa.false()),
        schema=SCHEMA,
    )
    op.add_column(
        TABLE,
        sa.Column("vm_installation_date", sa.Date(), nullable=True),
        schema=SCHEMA,
    )
    op.add_column(
        TABLE,
        sa.Column(
            "tools_integration_done", sa.Boolean(), nullable=False, server_default=sa.false()
        ),
        schema=SCHEMA,
    )
    op.add_column(
        TABLE,
        sa.Column("tools_integration_date", sa.Date(), nullable=True),
        schema=SCHEMA,
    )

    # Legacy combined firmware/N/W answers apply to both split fields.
    op.execute(
        f"""
        UPDATE {SCHEMA}.{TABLE}
        SET nw_config_done = firmware_config_done,
            nw_config_date = firmware_config_date
        WHERE firmware_config_done = true
        """
    )

    op.alter_column(TABLE, "nw_config_done", server_default=None, schema=SCHEMA)
    op.alter_column(TABLE, "vm_installation_done", server_default=None, schema=SCHEMA)
    op.alter_column(TABLE, "tools_integration_done", server_default=None, schema=SCHEMA)


def downgrade() -> None:
    op.drop_column(TABLE, "tools_integration_date", schema=SCHEMA)
    op.drop_column(TABLE, "tools_integration_done", schema=SCHEMA)
    op.drop_column(TABLE, "vm_installation_date", schema=SCHEMA)
    op.drop_column(TABLE, "vm_installation_done", schema=SCHEMA)
    op.drop_column(TABLE, "nw_config_date", schema=SCHEMA)
    op.drop_column(TABLE, "nw_config_done", schema=SCHEMA)

    op.alter_column(
        TABLE,
        "firmware_config_done",
        new_column_name="firmware_nw_config_done",
        schema=SCHEMA,
    )
    op.alter_column(
        TABLE,
        "firmware_config_date",
        new_column_name="firmware_nw_config_date",
        schema=SCHEMA,
    )
