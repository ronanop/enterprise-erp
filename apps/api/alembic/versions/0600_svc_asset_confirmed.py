"""Add asset_confirmed_at for mail-sourced asset confirmation workflow."""

from __future__ import annotations

from collections.abc import Sequence

import sqlalchemy as sa
from alembic import op

revision: str = "0600_svc_asset_confirmed"
down_revision: str | None = "0599_svc_mode_oem_support"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    op.add_column(
        "svc_service_request",
        sa.Column("asset_confirmed_at", sa.DateTime(timezone=True), nullable=True),
        schema="service",
    )


def downgrade() -> None:
    op.drop_column("svc_service_request", "asset_confirmed_at", schema="service")
