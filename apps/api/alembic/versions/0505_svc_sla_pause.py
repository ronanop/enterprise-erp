"""Service ticket SLA pause clock + pause timeline history."""

from __future__ import annotations

from collections.abc import Sequence

import sqlalchemy as sa
from alembic import op
from sqlalchemy.dialects import postgresql

revision: str = "0505_svc_sla_pause"
down_revision: str | None = "0504_svc_itsm_enhancements"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    op.add_column(
        "svc_service_request",
        sa.Column("sla_paused_at", sa.DateTime(timezone=True), nullable=True),
        schema="service",
    )
    op.add_column(
        "svc_service_request",
        sa.Column("sla_paused_total_minutes", sa.Integer(), nullable=False, server_default="0"),
        schema="service",
    )

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
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False, server_default=sa.func.now()),
        sa.ForeignKeyConstraint(
            ["request_id"],
            ["service.svc_service_request.id"],
            ondelete="CASCADE",
        ),
        schema="service",
    )
    op.create_index(
        "ix_svc_ticket_sla_pause_tenant_id",
        "svc_ticket_sla_pause",
        ["tenant_id"],
        schema="service",
    )
    op.create_index(
        "ix_svc_ticket_sla_pause_company_id",
        "svc_ticket_sla_pause",
        ["company_id"],
        schema="service",
    )
    op.create_index(
        "ix_svc_ticket_sla_pause_request_id",
        "svc_ticket_sla_pause",
        ["request_id"],
        schema="service",
    )
    op.create_index(
        "ix_svc_ticket_sla_pause_open",
        "svc_ticket_sla_pause",
        ["request_id"],
        unique=True,
        schema="service",
        postgresql_where=sa.text("resumed_at IS NULL"),
    )


def downgrade() -> None:
    op.drop_index("ix_svc_ticket_sla_pause_open", table_name="svc_ticket_sla_pause", schema="service")
    op.drop_index("ix_svc_ticket_sla_pause_request_id", table_name="svc_ticket_sla_pause", schema="service")
    op.drop_index("ix_svc_ticket_sla_pause_company_id", table_name="svc_ticket_sla_pause", schema="service")
    op.drop_index("ix_svc_ticket_sla_pause_tenant_id", table_name="svc_ticket_sla_pause", schema="service")
    op.drop_table("svc_ticket_sla_pause", schema="service")
    op.drop_column("svc_service_request", "sla_paused_total_minutes", schema="service")
    op.drop_column("svc_service_request", "sla_paused_at", schema="service")
