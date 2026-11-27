"""Split combined rack/server install checkboxes into four fields.

Revision ID: 0687_prj_site_install_split_checkboxes
Revises: 0686_assets_it_non_it_submodules
Create Date: 2026-11-27

Rack Installation + Server Stacking → rack_installation_* + server_stacking_*
Rack + Server Power On → rack_power_on_* + server_power_on_*
"""

from __future__ import annotations

from collections.abc import Sequence

import sqlalchemy as sa
from alembic import op

revision: str = "0687_prj_site_install_split_checkboxes"
down_revision: str | Sequence[str] | None = "0686_assets_it_non_it_submodules"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None

_BOOL_COLS = (
    "rack_installation_done",
    "server_stacking_done",
    "rack_power_on_done",
    "server_power_on_done",
)
_DATE_COLS = (
    "rack_installation_date",
    "server_stacking_date",
    "rack_power_on_date",
    "server_power_on_date",
)


def upgrade() -> None:
    for name in _BOOL_COLS:
        op.add_column(
            "prj_site_installation",
            sa.Column(
                name,
                sa.Boolean(),
                nullable=False,
                server_default=sa.text("false"),
            ),
            schema="project",
        )
    for name in _DATE_COLS:
        op.add_column(
            "prj_site_installation",
            sa.Column(name, sa.Date(), nullable=True),
            schema="project",
        )

    # Backfill from legacy combined columns.
    op.execute(
        """
        UPDATE project.prj_site_installation
        SET
          rack_installation_done = COALESCE(rack_server_stacking_done, false),
          server_stacking_done = COALESCE(rack_server_stacking_done, false),
          rack_installation_date = rack_server_stacking_date,
          server_stacking_date = rack_server_stacking_date,
          rack_power_on_done = COALESCE(rack_server_power_on_done, false),
          server_power_on_done = COALESCE(rack_server_power_on_done, false),
          rack_power_on_date = rack_server_power_on_date,
          server_power_on_date = rack_server_power_on_date
        """
    )


def downgrade() -> None:
    for name in _DATE_COLS:
        op.drop_column("prj_site_installation", name, schema="project")
    for name in _BOOL_COLS:
        op.drop_column("prj_site_installation", name, schema="project")
