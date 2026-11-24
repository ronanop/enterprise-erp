"""Add duration_minutes to svc_ticket_sla_pause (missed in 0680 port)."""

from __future__ import annotations

from collections.abc import Sequence

import sqlalchemy as sa
from alembic import op
from sqlalchemy import inspect

revision: str = "0681_svc_sla_pause_duration"
down_revision: str | Sequence[str] | None = "0680_svc_sla_pause"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    bind = op.get_bind()
    cols = {
        c["name"]
        for c in inspect(bind).get_columns("svc_ticket_sla_pause", schema="service")
    }
    if "duration_minutes" not in cols:
        op.add_column(
            "svc_ticket_sla_pause",
            sa.Column("duration_minutes", sa.Integer(), nullable=True),
            schema="service",
        )


def downgrade() -> None:
    bind = op.get_bind()
    cols = {
        c["name"]
        for c in inspect(bind).get_columns("svc_ticket_sla_pause", schema="service")
    }
    if "duration_minutes" in cols:
        op.drop_column("svc_ticket_sla_pause", "duration_minutes", schema="service")
