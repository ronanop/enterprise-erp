"""Field engineer work brief + visibility of ticket fields for FE portal."""

from __future__ import annotations

from collections.abc import Sequence

import sqlalchemy as sa
from alembic import op
from sqlalchemy.dialects import postgresql

revision: str = "0597_svc_fe_visibility"
down_revision: str | None = "0596_svc_attachment_bytes"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    op.add_column(
        "svc_ticket_field_engineer",
        sa.Column("work_brief", sa.Text(), nullable=True),
        schema="service",
    )
    op.add_column(
        "svc_ticket_field_engineer",
        sa.Column("show_issue", sa.Boolean(), nullable=False, server_default=sa.text("true")),
        schema="service",
    )
    op.add_column(
        "svc_ticket_field_engineer",
        sa.Column("show_customer", sa.Boolean(), nullable=False, server_default=sa.text("true")),
        schema="service",
    )
    op.add_column(
        "svc_ticket_field_engineer",
        sa.Column("show_site", sa.Boolean(), nullable=False, server_default=sa.text("true")),
        schema="service",
    )
    op.add_column(
        "svc_ticket_field_engineer",
        sa.Column("show_asset", sa.Boolean(), nullable=False, server_default=sa.text("true")),
        schema="service",
    )
    op.add_column(
        "svc_ticket_field_engineer",
        sa.Column("show_circuit", sa.Boolean(), nullable=False, server_default=sa.text("true")),
        schema="service",
    )


def downgrade() -> None:
    op.drop_column("svc_ticket_field_engineer", "show_circuit", schema="service")
    op.drop_column("svc_ticket_field_engineer", "show_asset", schema="service")
    op.drop_column("svc_ticket_field_engineer", "show_site", schema="service")
    op.drop_column("svc_ticket_field_engineer", "show_customer", schema="service")
    op.drop_column("svc_ticket_field_engineer", "show_issue", schema="service")
    op.drop_column("svc_ticket_field_engineer", "work_brief", schema="service")
