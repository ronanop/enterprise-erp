"""Add remaining site-installation flow fields from delivery notes."""

import sys
from collections.abc import Sequence
from pathlib import Path

import sqlalchemy as sa
from alembic import op

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))

from helpers import add_column_if_missing  # noqa: E402

revision: str = "0460_prj_site_flow_fields"
down_revision: str | None = "0459_seed_demo_telecom_customers"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None

TABLE = "prj_site_installation"
SCHEMA = "project"


def upgrade() -> None:
    # Intake
    add_column_if_missing(
        TABLE,
        sa.Column("power_requirements", sa.Text(), nullable=True),
        schema=SCHEMA,
    )
    add_column_if_missing(
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
    add_column_if_missing(
        TABLE,
        sa.Column("cable_length", sa.String(length=100), nullable=True),
        schema=SCHEMA,
    )
    add_column_if_missing(
        TABLE,
        sa.Column(
            "industrial_socket",
            sa.Boolean(),
            nullable=False,
            server_default=sa.text("false"),
        ),
        schema=SCHEMA,
    )
    add_column_if_missing(
        TABLE,
        sa.Column(
            "lugs",
            sa.Boolean(),
            nullable=False,
            server_default=sa.text("false"),
        ),
        schema=SCHEMA,
    )
    add_column_if_missing(
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
    add_column_if_missing(
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
    add_column_if_missing(
        TABLE,
        sa.Column(
            "firmware_nw_config_done",
            sa.Boolean(),
            nullable=False,
            server_default=sa.text("false"),
        ),
        schema=SCHEMA,
    )
    add_column_if_missing(
        TABLE,
        sa.Column(
            "os_installation_done",
            sa.Boolean(),
            nullable=False,
            server_default=sa.text("false"),
        ),
        schema=SCHEMA,
    )
    add_column_if_missing(
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
