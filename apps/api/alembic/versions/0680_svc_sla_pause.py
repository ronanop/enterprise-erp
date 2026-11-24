"""Service ticket SLA pause clock + pause timeline history.

Ported from Service-management ``0505_svc_sla_pause``.
"""

from __future__ import annotations

from collections.abc import Sequence

import sqlalchemy as sa
from alembic import op
from sqlalchemy import inspect
from sqlalchemy.dialects import postgresql

revision: str = "0680_svc_sla_pause"
down_revision: str | Sequence[str] | None = "0679_svc_itsm_enhancements"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def _has_column(table: str, column: str, *, schema: str) -> bool:
    bind = op.get_bind()
    cols = {c["name"] for c in inspect(bind).get_columns(table, schema=schema)}
    return column in cols


def _has_table(table: str, *, schema: str) -> bool:
    bind = op.get_bind()
    return table in inspect(bind).get_table_names(schema=schema)


def upgrade() -> None:
    if not _has_column("svc_service_request", "sla_paused_at", schema="service"):
        op.add_column(
            "svc_service_request",
            sa.Column("sla_paused_at", sa.DateTime(timezone=True), nullable=True),
            schema="service",
        )
    if not _has_column("svc_service_request", "sla_paused_total_minutes", schema="service"):
        op.add_column(
            "svc_service_request",
            sa.Column(
                "sla_paused_total_minutes",
                sa.Integer(),
                nullable=False,
                server_default="0",
            ),
            schema="service",
        )

    if not _has_table("svc_ticket_sla_pause", schema="service"):
        op.create_table(
            "svc_ticket_sla_pause",
            sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True),
            sa.Column("tenant_id", postgresql.UUID(as_uuid=True), nullable=False),
            sa.Column("company_id", postgresql.UUID(as_uuid=True), nullable=False),
            sa.Column("request_id", postgresql.UUID(as_uuid=True), nullable=False),
            sa.Column("paused_at", sa.DateTime(timezone=True), nullable=False),
            sa.Column("resumed_at", sa.DateTime(timezone=True), nullable=True),
            sa.Column("reason", sa.Text(), nullable=False),
            sa.Column("resume_reason", sa.Text(), nullable=True),
            sa.Column("paused_by", postgresql.UUID(as_uuid=True), nullable=True),
            sa.Column("resumed_by", postgresql.UUID(as_uuid=True), nullable=True),
            sa.Column("duration_minutes", sa.Integer(), nullable=True),
            sa.Column(
                "created_at",
                sa.DateTime(timezone=True),
                server_default=sa.text("now()"),
                nullable=False,
            ),
            sa.ForeignKeyConstraint(
                ["request_id"], ["service.svc_service_request.id"], ondelete="CASCADE"
            ),
            schema="service",
        )
        op.create_index(
            "ix_svc_ticket_sla_pause_request",
            "svc_ticket_sla_pause",
            ["request_id", "paused_at"],
            schema="service",
        )
    elif not _has_column("svc_ticket_sla_pause", "duration_minutes", schema="service"):
        op.add_column(
            "svc_ticket_sla_pause",
            sa.Column("duration_minutes", sa.Integer(), nullable=True),
            schema="service",
        )


def downgrade() -> None:
    if _has_table("svc_ticket_sla_pause", schema="service"):
        op.drop_table("svc_ticket_sla_pause", schema="service")
    if _has_column("svc_service_request", "sla_paused_total_minutes", schema="service"):
        op.drop_column("svc_service_request", "sla_paused_total_minutes", schema="service")
    if _has_column("svc_service_request", "sla_paused_at", schema="service"):
        op.drop_column("svc_service_request", "sla_paused_at", schema="service")
