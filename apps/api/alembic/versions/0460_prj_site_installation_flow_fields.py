"""Add remaining site-installation flow fields from delivery notes."""

from collections.abc import Sequence

import sqlalchemy as sa
from alembic import op

revision: str = "0460_prj_site_flow_fields"
down_revision: str | None = "0459_seed_demo_telecom_customers"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None

TABLE = "prj_site_installation"
SCHEMA = "project"


def upgrade() -> None:
    # Intake
    op.add_column(
        TABLE,
        sa.Column("power_requirements", sa.Text(), nullable=True),
        schema=SCHEMA,
    )
    op.add_column(
        TABLE,
        sa.Column(
            "rfai_request_done",
            sa.Boolean(),
            nullable=False,
            server_default=sa.text("false"),
        ),
        schema=SCHEMA,
    )
    # Survey detail
    op.add_column(
        TABLE,
        sa.Column("cable_length", sa.String(length=100), nullable=True),
        schema=SCHEMA,
    )
    op.add_column(
        TABLE,
        sa.Column(
            "industrial_socket",
            sa.Boolean(),
            nullable=False,
            server_default=sa.text("false"),
        ),
        schema=SCHEMA,
    )
    op.add_column(
        TABLE,
        sa.Column(
            "lugs",
            sa.Boolean(),
            nullable=False,
            server_default=sa.text("false"),
        ),
        schema=SCHEMA,
    )
    op.add_column(
        TABLE,
        sa.Column(
            "power_on_material",
            sa.Boolean(),
            nullable=False,
            server_default=sa.text("false"),
        ),
        schema=SCHEMA,
    )
    # SCM
    op.add_column(
        TABLE,
        sa.Column(
            "material_handover_done",
            sa.Boolean(),
            nullable=False,
            server_default=sa.text("false"),
        ),
        schema=SCHEMA,
    )
    # Configuration
    op.add_column(
        TABLE,
        sa.Column(
            "firmware_nw_config_done",
            sa.Boolean(),
            nullable=False,
            server_default=sa.text("false"),
        ),
        schema=SCHEMA,
    )
    op.add_column(
        TABLE,
        sa.Column(
            "os_installation_done",
            sa.Boolean(),
            nullable=False,
            server_default=sa.text("false"),
        ),
        schema=SCHEMA,
    )
    op.add_column(
        TABLE,
        sa.Column(
            "mbss_done",
            sa.Boolean(),
            nullable=False,
            server_default=sa.text("false"),
        ),
        schema=SCHEMA,
    )


def downgrade() -> None:
    for col in (
        "mbss_done",
        "os_installation_done",
        "firmware_nw_config_done",
        "material_handover_done",
        "power_on_material",
        "lugs",
        "industrial_socket",
        "cable_length",
        "rfai_request_done",
        "power_requirements",
    ):
        op.drop_column(TABLE, col, schema=SCHEMA)
