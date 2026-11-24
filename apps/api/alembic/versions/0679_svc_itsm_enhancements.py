"""Service ITSM enhancements: asset confirm, issue/resolution masters, SLA matrix, reopen, visits.

Ported from Service-management ``0504_svc_itsm_enhancements`` onto main alembic head.
"""

from __future__ import annotations

from collections.abc import Sequence

import sqlalchemy as sa
from alembic import op
from sqlalchemy import inspect
from sqlalchemy.dialects import postgresql

revision: str = "0679_svc_itsm_enhancements"
down_revision: str | Sequence[str] | None = "0678_sales_targets_and_permissions"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def _has_column(table: str, column: str, *, schema: str) -> bool:
    bind = op.get_bind()
    cols = {c["name"] for c in inspect(bind).get_columns(table, schema=schema)}
    return column in cols


def _has_table(table: str, *, schema: str) -> bool:
    bind = op.get_bind()
    return table in inspect(bind).get_table_names(schema=schema)


def _add_column(table: str, column: sa.Column, *, schema: str) -> None:
    if not _has_column(table, column.name, schema=schema):
        op.add_column(table, column, schema=schema)


def upgrade() -> None:
    _add_column(
        "svc_service_request",
        sa.Column("asset_confirmed_by", postgresql.UUID(as_uuid=True), nullable=True),
        schema="service",
    )
    _add_column(
        "svc_service_request",
        sa.Column("issue_reported_code", sa.String(80), nullable=True),
        schema="service",
    )
    _add_column(
        "svc_service_request",
        sa.Column("resolution_comment_code", sa.String(80), nullable=True),
        schema="service",
    )
    _add_column(
        "svc_service_request",
        sa.Column("other_remarks", sa.Text(), nullable=True),
        schema="service",
    )
    _add_column(
        "svc_service_request",
        sa.Column("sla_policy_snapshot", postgresql.JSONB(astext_type=sa.Text()), nullable=True),
        schema="service",
    )
    _add_column(
        "svc_service_request",
        sa.Column("sla_target_minutes", sa.Integer(), nullable=True),
        schema="service",
    )
    _add_column(
        "svc_service_request",
        sa.Column("present_type", sa.String(100), nullable=True),
        schema="service",
    )
    _add_column(
        "svc_service_request",
        sa.Column("field_manual_overrides", postgresql.JSONB(astext_type=sa.Text()), nullable=True),
        schema="service",
    )

    bind = op.get_bind()
    indexes = {ix["name"] for ix in inspect(bind).get_indexes("svc_service_request", schema="service")}
    if "ix_svc_request_tenant_customer_ckt" not in indexes:
        op.create_index(
            "ix_svc_request_tenant_customer_ckt",
            "svc_service_request",
            ["tenant_id", "customer_id", "ckt_id"],
            schema="service",
        )

    # Ticket option types: issue_reported / resolution_comment
    op.execute("ALTER TABLE service.svc_ticket_option DROP CONSTRAINT IF EXISTS ck_svc_ticket_option_type")
    op.create_check_constraint(
        "ck_svc_ticket_option_type",
        "svc_ticket_option",
        "option_type IN ('mode','category','issue_reported','resolution_comment')",
        schema="service",
    )

    for name, col in (
        ("hardware_repair", sa.Column("hardware_repair", sa.String(10), nullable=True)),
        ("hardware_replacement_yn", sa.Column("hardware_replacement_yn", sa.String(10), nullable=True)),
        ("new_device_serial", sa.Column("new_device_serial", sa.String(100), nullable=True)),
        ("other_charges", sa.Column("other_charges", sa.Numeric(14, 2), nullable=True)),
        ("visit_notes_history", sa.Column("visit_notes_history", sa.Text(), nullable=True)),
    ):
        _add_column("svc_service_field_engineer_visit", col, schema="service")

    _add_column(
        "svc_email_ingest_log",
        sa.Column("extraction_json", postgresql.JSONB(astext_type=sa.Text()), nullable=True),
        schema="service",
    )

    if not _has_table("svc_ticket_assignment_history", schema="service"):
        op.create_table(
            "svc_ticket_assignment_history",
            sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True),
            sa.Column("tenant_id", postgresql.UUID(as_uuid=True), nullable=False),
            sa.Column("company_id", postgresql.UUID(as_uuid=True), nullable=False),
            sa.Column("request_id", postgresql.UUID(as_uuid=True), nullable=False),
            sa.Column("old_owner_employee_id", postgresql.UUID(as_uuid=True), nullable=True),
            sa.Column("new_owner_employee_id", postgresql.UUID(as_uuid=True), nullable=True),
            sa.Column("change_type", sa.String(30), nullable=False),
            sa.Column("reason", sa.Text(), nullable=True),
            sa.Column("changed_by", postgresql.UUID(as_uuid=True), nullable=True),
            sa.Column("changed_at", sa.DateTime(timezone=True), nullable=False),
            sa.Column(
                "created_at",
                sa.DateTime(timezone=True),
                server_default=sa.text("now()"),
                nullable=False,
            ),
            sa.ForeignKeyConstraint(
                ["request_id"], ["service.svc_service_request.id"], ondelete="CASCADE"
            ),
            sa.CheckConstraint(
                "change_type IN ('assign','reassign','co_owner_add','co_owner_remove')",
                name="ck_svc_ticket_assignment_history_type",
            ),
            schema="service",
        )
        op.create_index(
            "ix_svc_ticket_assignment_history_request",
            "svc_ticket_assignment_history",
            ["request_id", "changed_at"],
            schema="service",
        )

    if not _has_table("svc_customer_priority_sla", schema="service"):
        op.create_table(
            "svc_customer_priority_sla",
            sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True),
            sa.Column("tenant_id", postgresql.UUID(as_uuid=True), nullable=False),
            sa.Column("company_id", postgresql.UUID(as_uuid=True), nullable=False),
            sa.Column("customer_id", postgresql.UUID(as_uuid=True), nullable=False),
            sa.Column("priority", sa.String(20), nullable=False),
            sa.Column("duration_minutes", sa.Integer(), nullable=False),
            sa.Column(
                "calendar_type", sa.String(20), nullable=False, server_default="calendar"
            ),
            sa.Column("effective_from", sa.Date(), nullable=True),
            sa.Column("effective_to", sa.Date(), nullable=True),
            sa.Column("escalation_json", postgresql.JSONB(astext_type=sa.Text()), nullable=True),
            sa.Column(
                "sla_id",
                postgresql.UUID(as_uuid=True),
                sa.ForeignKey("service.svc_service_sla.id", ondelete="SET NULL"),
                nullable=True,
            ),
            sa.Column("is_active", sa.Boolean(), nullable=False, server_default=sa.text("true")),
            sa.Column(
                "created_at",
                sa.DateTime(timezone=True),
                nullable=False,
                server_default=sa.text("now()"),
            ),
            sa.Column(
                "updated_at",
                sa.DateTime(timezone=True),
                nullable=False,
                server_default=sa.text("now()"),
            ),
            sa.Column("created_by", postgresql.UUID(as_uuid=True), nullable=True),
            sa.Column("updated_by", postgresql.UUID(as_uuid=True), nullable=True),
            sa.Column("is_deleted", sa.Boolean(), nullable=False, server_default=sa.text("false")),
            sa.Column("deleted_at", sa.DateTime(timezone=True), nullable=True),
            sa.Column("deleted_by", postgresql.UUID(as_uuid=True), nullable=True),
            sa.Column("version", sa.Integer(), nullable=False, server_default="1"),
            sa.ForeignKeyConstraint(
                ["customer_id"], ["master.master_customer.id"], ondelete="RESTRICT"
            ),
            schema="service",
        )
        op.create_index(
            "ix_svc_customer_priority_sla_lookup",
            "svc_customer_priority_sla",
            ["tenant_id", "company_id", "customer_id", "priority"],
            schema="service",
        )

    if not _has_table("svc_ticket_reopen_request", schema="service"):
        op.create_table(
            "svc_ticket_reopen_request",
            sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True),
            sa.Column("tenant_id", postgresql.UUID(as_uuid=True), nullable=False),
            sa.Column("company_id", postgresql.UUID(as_uuid=True), nullable=False),
            sa.Column("request_id", postgresql.UUID(as_uuid=True), nullable=False),
            sa.Column("reason", sa.Text(), nullable=False),
            sa.Column("requested_by", postgresql.UUID(as_uuid=True), nullable=True),
            sa.Column("requested_at", sa.DateTime(timezone=True), nullable=False),
            sa.Column("status", sa.String(20), nullable=False, server_default="pending"),
            sa.Column("approved_by", postgresql.UUID(as_uuid=True), nullable=True),
            sa.Column("approved_at", sa.DateTime(timezone=True), nullable=True),
            sa.Column("rejection_reason", sa.Text(), nullable=True),
            sa.Column(
                "created_at",
                sa.DateTime(timezone=True),
                nullable=False,
                server_default=sa.text("now()"),
            ),
            sa.Column(
                "updated_at",
                sa.DateTime(timezone=True),
                nullable=False,
                server_default=sa.text("now()"),
            ),
            sa.ForeignKeyConstraint(
                ["request_id"], ["service.svc_service_request.id"], ondelete="CASCADE"
            ),
            sa.CheckConstraint(
                "status IN ('pending','approved','rejected')",
                name="ck_svc_ticket_reopen_status",
            ),
            schema="service",
        )
        op.create_index(
            "ix_svc_ticket_reopen_request_ticket",
            "svc_ticket_reopen_request",
            ["request_id", "status"],
            schema="service",
        )


def downgrade() -> None:
    if _has_table("svc_ticket_reopen_request", schema="service"):
        op.drop_table("svc_ticket_reopen_request", schema="service")
    if _has_table("svc_customer_priority_sla", schema="service"):
        op.drop_table("svc_customer_priority_sla", schema="service")
    if _has_table("svc_ticket_assignment_history", schema="service"):
        op.drop_table("svc_ticket_assignment_history", schema="service")

    if _has_column("svc_email_ingest_log", "extraction_json", schema="service"):
        op.drop_column("svc_email_ingest_log", "extraction_json", schema="service")

    for col in (
        "visit_notes_history",
        "other_charges",
        "new_device_serial",
        "hardware_replacement_yn",
        "hardware_repair",
    ):
        if _has_column("svc_service_field_engineer_visit", col, schema="service"):
            op.drop_column("svc_service_field_engineer_visit", col, schema="service")

    op.execute("ALTER TABLE service.svc_ticket_option DROP CONSTRAINT IF EXISTS ck_svc_ticket_option_type")
    op.create_check_constraint(
        "ck_svc_ticket_option_type",
        "svc_ticket_option",
        "option_type IN ('mode','category')",
        schema="service",
    )

    bind = op.get_bind()
    indexes = {ix["name"] for ix in inspect(bind).get_indexes("svc_service_request", schema="service")}
    if "ix_svc_request_tenant_customer_ckt" in indexes:
        op.drop_index(
            "ix_svc_request_tenant_customer_ckt",
            table_name="svc_service_request",
            schema="service",
        )
    for col in (
        "field_manual_overrides",
        "present_type",
        "sla_target_minutes",
        "sla_policy_snapshot",
        "other_remarks",
        "resolution_comment_code",
        "issue_reported_code",
        "asset_confirmed_by",
    ):
        if _has_column("svc_service_request", col, schema="service"):
            op.drop_column("svc_service_request", col, schema="service")
