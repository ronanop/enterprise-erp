"""Ticket open + SLA start timestamps for service request workflow."""

from collections.abc import Sequence

import sqlalchemy as sa
from alembic import op

revision: str = "0592_svc_ticket_open_sla"
down_revision: str | None = "0591_svc_ticket_collab"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None

SCHEMA = "service"


def upgrade() -> None:
    op.add_column(
        "svc_service_request",
        sa.Column("opened_at", sa.DateTime(timezone=True), nullable=True),
        schema=SCHEMA,
    )
    op.add_column(
        "svc_service_request",
        sa.Column("opened_by", sa.UUID(), nullable=True),
        schema=SCHEMA,
    )
    op.add_column(
        "svc_service_request",
        sa.Column("sla_started_at", sa.DateTime(timezone=True), nullable=True),
        schema=SCHEMA,
    )


def downgrade() -> None:
    for col in ("sla_started_at", "opened_by", "opened_at"):
        op.drop_column("svc_service_request", col, schema=SCHEMA)
