"""Service notebook enhancements: remote engineer, options, follow-ups, awaiting status."""

from __future__ import annotations

from collections.abc import Sequence

import sqlalchemy as sa
from alembic import op
from sqlalchemy.dialects.postgresql import UUID as PG_UUID

revision: str = "0496_svc_notebook_enhancements"
down_revision: str | None = "0495_mkt_business_owner"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    op.execute("ALTER TABLE service.svc_service_request DROP CONSTRAINT IF EXISTS ck_svc_service_request_status")
    op.execute(
        """
        ALTER TABLE service.svc_service_request
        ADD CONSTRAINT ck_svc_service_request_status
        CHECK (status IN (
            'draft','submitted','approved','new','ticket_registered','awaiting_assignment',
            'assigned','in_progress','engineer_working','pending_customer','pending_oem',
            'resolved','closed','cancelled'
        ))
        """
    )

    op.add_column(
        "svc_service_request",
        sa.Column("remote_engineer_name", sa.String(255), nullable=True),
        schema="service",
    )
    op.add_column(
        "svc_service_request",
        sa.Column("remote_engineer_contact", sa.String(50), nullable=True),
        schema="service",
    )
    op.add_column(
        "svc_service_request",
        sa.Column("remote_engineer_date", sa.Date(), nullable=True),
        schema="service",
    )
    op.add_column(
        "svc_service_request",
        sa.Column("follow_up_at", sa.DateTime(timezone=True), nullable=True),
        schema="service",
    )
    op.add_column(
        "svc_service_request",
        sa.Column("follow_up_note", sa.Text(), nullable=True),
        schema="service",
    )

    op.create_table(
        "svc_ticket_option",
        sa.Column("id", PG_UUID(as_uuid=True), primary_key=True),
        sa.Column("tenant_id", PG_UUID(as_uuid=True), sa.ForeignKey("foundation.sec_tenant.id"), nullable=False),
        sa.Column("company_id", PG_UUID(as_uuid=True), sa.ForeignKey("organization.org_company.id"), nullable=False),
        sa.Column("option_type", sa.String(40), nullable=False),
        sa.Column("option_code", sa.String(80), nullable=False),
        sa.Column("option_label", sa.String(255), nullable=False),
        sa.Column("sort_order", sa.Integer(), nullable=False, server_default="0"),
        sa.Column("status", sa.String(30), nullable=False, server_default="active"),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.text("now()"), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.text("now()"), nullable=False),
        sa.Column("created_by", PG_UUID(as_uuid=True), nullable=True),
        sa.Column("updated_by", PG_UUID(as_uuid=True), nullable=True),
        sa.Column("is_deleted", sa.Boolean(), nullable=False, server_default=sa.text("false")),
        sa.Column("deleted_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("deleted_by", PG_UUID(as_uuid=True), nullable=True),
        sa.Column("version", sa.Integer(), nullable=False, server_default="1"),
        sa.CheckConstraint("option_type IN ('mode','category')", name="ck_svc_ticket_option_type"),
        sa.CheckConstraint("status IN ('active','inactive')", name="ck_svc_ticket_option_status"),
        sa.UniqueConstraint("company_id", "option_type", "option_code", name="uk_svc_ticket_option_code"),
        schema="service",
    )
    op.create_index("ix_svc_ticket_option_type", "svc_ticket_option", ["option_type", "status"], schema="service")

    # Seed default mode/category options per company that already has service categories
    op.execute(
        """
        INSERT INTO service.svc_ticket_option
            (id, tenant_id, company_id, option_type, option_code, option_label, sort_order, status, created_at, updated_at, is_deleted, version)
        SELECT gen_random_uuid(), c.tenant_id, c.id, v.option_type, v.option_code, v.option_label, v.sort_order,
               'active', now(), now(), false, 1
        FROM organization.org_company c
        CROSS JOIN (
            VALUES
                ('mode', 'remote_support', 'Remote Support', 1),
                ('mode', 'onsite_support', 'Onsite Support', 2),
                ('category', 'hardware', 'Hardware', 1),
                ('category', 'software', 'Software', 2),
                ('category', 'network', 'Network', 3)
        ) AS v(option_type, option_code, option_label, sort_order)
        WHERE c.is_deleted = false
        ON CONFLICT ON CONSTRAINT uk_svc_ticket_option_code DO NOTHING
        """
    )

    # Align existing registered tickets display path: keep ticket_registered;
    # awaiting_assignment is available for pause/resume going forward.
    op.execute(
        """
        UPDATE service.svc_service_sla
        SET business_hours_only = false
        WHERE business_hours_only = true
        """
    )


def downgrade() -> None:
    op.drop_table("svc_ticket_option", schema="service")
    op.drop_column("svc_service_request", "follow_up_note", schema="service")
    op.drop_column("svc_service_request", "follow_up_at", schema="service")
    op.drop_column("svc_service_request", "remote_engineer_date", schema="service")
    op.drop_column("svc_service_request", "remote_engineer_contact", schema="service")
    op.drop_column("svc_service_request", "remote_engineer_name", schema="service")
    op.execute("ALTER TABLE service.svc_service_request DROP CONSTRAINT IF EXISTS ck_svc_service_request_status")
    op.execute(
        """
        ALTER TABLE service.svc_service_request
        ADD CONSTRAINT ck_svc_service_request_status
        CHECK (status IN (
            'draft','submitted','approved','new','ticket_registered','assigned',
            'in_progress','engineer_working','pending_customer','pending_oem',
            'resolved','closed','cancelled'
        ))
        """
    )
