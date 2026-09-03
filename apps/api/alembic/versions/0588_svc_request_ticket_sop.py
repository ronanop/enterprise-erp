"""Service Request Ticket SOP fields and child tables."""

from collections.abc import Sequence

import sqlalchemy as sa
from alembic import op
from sqlalchemy.dialects.postgresql import UUID

revision: str = "0588_svc_request_ticket_sop"
down_revision: str | None = "0587_grant_proc_master_vendor_reads"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None

SCHEMA = "service"


def upgrade() -> None:
    # Extend priority constraint for SOP P1-P4
    op.drop_constraint("ck_svc_service_request_priority", "svc_service_request", schema=SCHEMA, type_="check")
    op.create_check_constraint(
        "ck_svc_service_request_priority",
        "svc_service_request",
        "priority IN ('low','medium','high','critical','p1','p2','p3','p4')",
        schema=SCHEMA,
    )

    # Extend status constraint for SOP workflow
    op.drop_constraint("ck_svc_service_request_status", "svc_service_request", schema=SCHEMA, type_="check")
    op.create_check_constraint(
        "ck_svc_service_request_status",
        "svc_service_request",
        "status IN ('draft','submitted','approved','new','ticket_registered','assigned',"
        "'in_progress','engineer_working','pending_customer','pending_oem',"
        "'resolved','closed','cancelled')",
        schema=SCHEMA,
    )

    # SOP fields on service request
    sop_columns = [
        ("mode_of_action", sa.String(40), True),
        ("contact_name", sa.String(255), True),
        ("email", sa.String(255), True),
        ("alternate_email", sa.String(255), True),
        ("mobile", sa.String(50), True),
        ("owner_employee_id", UUID(as_uuid=True), True),
        ("product_id", UUID(as_uuid=True), True),
        ("contact_id", UUID(as_uuid=True), True),
        ("software_version", sa.String(100), True),
        ("issue_description", sa.Text(), True),
        ("reference_sr_number", sa.String(100), True),
        ("customer_reference", sa.String(100), True),
        ("lsi", sa.String(100), True),
        ("end_customer_name", sa.String(255), True),
        ("end_customer_email", sa.String(255), True),
        ("coordinator_name", sa.String(255), True),
        ("coordinator_phone", sa.String(50), True),
        ("end_customer_street", sa.String(500), True),
        ("end_customer_state", sa.String(100), True),
        ("end_customer_city", sa.String(100), True),
        ("end_customer_city_type", sa.String(50), True),
        ("end_customer_other_city", sa.String(100), True),
        ("end_customer_gst", sa.String(50), True),
        ("end_customer_postal_code", sa.String(20), True),
        ("start_work_date", sa.DateTime(timezone=True), True),
        ("classification", sa.String(50), True),
        ("escalation_reason", sa.Text(), True),
        ("next_plan", sa.Text(), True),
        ("additional_description", sa.Text(), True),
        ("oem_support_enabled", sa.Boolean(), False),
        ("asset_name", sa.String(255), True),
        ("serial_number", sa.String(100), True),
        ("warranty_start_date", sa.Date(), True),
        ("warranty_end_date", sa.Date(), True),
        ("amc_end_date", sa.Date(), True),
        ("asset_status", sa.String(50), True),
        ("amc_mail_sent", sa.Boolean(), False),
        ("ticket_category", sa.String(50), True),
    ]
    for name, col_type, nullable in sop_columns:
        if isinstance(col_type, sa.Boolean):
            op.add_column(
                "svc_service_request",
                sa.Column(name, sa.Boolean(), nullable=False, server_default=sa.text("false")),
                schema=SCHEMA,
            )
        else:
            op.add_column(
                "svc_service_request",
                sa.Column(name, col_type, nullable=nullable),
                schema=SCHEMA,
            )

    op.create_foreign_key(
        "fk_svc_request_owner_employee",
        "svc_service_request",
        "master_employee",
        ["owner_employee_id"],
        ["id"],
        source_schema=SCHEMA,
        referent_schema="master",
        ondelete="SET NULL",
    )
    op.create_foreign_key(
        "fk_svc_request_product",
        "svc_service_request",
        "master_product",
        ["product_id"],
        ["id"],
        source_schema=SCHEMA,
        referent_schema="master",
        ondelete="SET NULL",
    )

    # Comments
    op.create_table(
        "svc_service_request_comment",
        sa.Column("id", UUID(as_uuid=True), primary_key=True),
        sa.Column("tenant_id", UUID(as_uuid=True), nullable=False),
        sa.Column("company_id", UUID(as_uuid=True), nullable=False),
        sa.Column("branch_id", UUID(as_uuid=True), nullable=True),
        sa.Column("request_id", UUID(as_uuid=True), sa.ForeignKey(f"{SCHEMA}.svc_service_request.id", ondelete="CASCADE"), nullable=False),
        sa.Column("author_user_id", UUID(as_uuid=True), nullable=True),
        sa.Column("body", sa.Text(), nullable=False),
        sa.Column("is_internal", sa.Boolean(), nullable=False, server_default=sa.text("true")),
        sa.Column("commented_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("status", sa.String(30), nullable=False, server_default="active"),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False, server_default=sa.text("now()")),
        sa.Column("created_by", UUID(as_uuid=True), nullable=True),
        sa.Column("updated_at", sa.DateTime(timezone=True), nullable=False, server_default=sa.text("now()")),
        sa.Column("updated_by", UUID(as_uuid=True), nullable=True),
        sa.Column("is_deleted", sa.Boolean(), nullable=False, server_default=sa.text("false")),
        sa.Column("deleted_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("deleted_by", UUID(as_uuid=True), nullable=True),
        sa.Column("version", sa.Integer(), nullable=False, server_default="1"),
        schema=SCHEMA,
    )
    op.create_index("ix_svc_request_comment_request", "svc_service_request_comment", ["request_id"], schema=SCHEMA)

    # Field engineer visit (1:1 per request when onsite)
    op.create_table(
        "svc_service_field_engineer_visit",
        sa.Column("id", UUID(as_uuid=True), primary_key=True),
        sa.Column("tenant_id", UUID(as_uuid=True), nullable=False),
        sa.Column("company_id", UUID(as_uuid=True), nullable=False),
        sa.Column("branch_id", UUID(as_uuid=True), nullable=True),
        sa.Column("request_id", UUID(as_uuid=True), sa.ForeignKey(f"{SCHEMA}.svc_service_request.id", ondelete="CASCADE"), nullable=False, unique=True),
        sa.Column("engineer_name", sa.String(255), nullable=True),
        sa.Column("engineer_contact", sa.String(50), nullable=True),
        sa.Column("distance", sa.String(100), nullable=True),
        sa.Column("visits_count", sa.Integer(), nullable=True),
        sa.Column("carrying_spares", sa.Boolean(), nullable=False, server_default=sa.text("false")),
        sa.Column("visit_date", sa.Date(), nullable=True),
        sa.Column("hw_replacement", sa.String(255), nullable=True),
        sa.Column("transport_mode", sa.String(100), nullable=True),
        sa.Column("movement_charges", sa.Numeric(14, 2), nullable=True),
        sa.Column("visit_charges", sa.Numeric(14, 2), nullable=True),
        sa.Column("total_charges", sa.Numeric(14, 2), nullable=True),
        sa.Column("remarks", sa.Text(), nullable=True),
        sa.Column("payment_approval", sa.String(50), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False, server_default=sa.text("now()")),
        sa.Column("created_by", UUID(as_uuid=True), nullable=True),
        sa.Column("updated_at", sa.DateTime(timezone=True), nullable=False, server_default=sa.text("now()")),
        sa.Column("updated_by", UUID(as_uuid=True), nullable=True),
        sa.Column("is_deleted", sa.Boolean(), nullable=False, server_default=sa.text("false")),
        sa.Column("version", sa.Integer(), nullable=False, server_default="1"),
        schema=SCHEMA,
    )

    # OEM support (1:1 when enabled)
    op.create_table(
        "svc_service_oem_support",
        sa.Column("id", UUID(as_uuid=True), primary_key=True),
        sa.Column("tenant_id", UUID(as_uuid=True), nullable=False),
        sa.Column("company_id", UUID(as_uuid=True), nullable=False),
        sa.Column("branch_id", UUID(as_uuid=True), nullable=True),
        sa.Column("request_id", UUID(as_uuid=True), sa.ForeignKey(f"{SCHEMA}.svc_service_request.id", ondelete="CASCADE"), nullable=False, unique=True),
        sa.Column("oem_name", sa.String(255), nullable=True),
        sa.Column("oem_ticket_number", sa.String(100), nullable=True),
        sa.Column("customer_reference", sa.String(100), nullable=True),
        sa.Column("ticket_type", sa.String(50), nullable=True),
        sa.Column("oem_engineer_contact", sa.String(500), nullable=True),
        sa.Column("tac_response_summary", sa.Text(), nullable=True),
        sa.Column("tac_resolution", sa.Text(), nullable=True),
        sa.Column("oem_status", sa.String(50), nullable=True),
        sa.Column("last_checked_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False, server_default=sa.text("now()")),
        sa.Column("created_by", UUID(as_uuid=True), nullable=True),
        sa.Column("updated_at", sa.DateTime(timezone=True), nullable=False, server_default=sa.text("now()")),
        sa.Column("updated_by", UUID(as_uuid=True), nullable=True),
        sa.Column("is_deleted", sa.Boolean(), nullable=False, server_default=sa.text("false")),
        sa.Column("version", sa.Integer(), nullable=False, server_default="1"),
        schema=SCHEMA,
    )

    # Status history
    op.create_table(
        "svc_service_request_status_history",
        sa.Column("id", UUID(as_uuid=True), primary_key=True),
        sa.Column("tenant_id", UUID(as_uuid=True), nullable=False),
        sa.Column("company_id", UUID(as_uuid=True), nullable=False),
        sa.Column("request_id", UUID(as_uuid=True), sa.ForeignKey(f"{SCHEMA}.svc_service_request.id", ondelete="CASCADE"), nullable=False),
        sa.Column("from_status", sa.String(50), nullable=True),
        sa.Column("to_status", sa.String(50), nullable=False),
        sa.Column("changed_by", UUID(as_uuid=True), nullable=True),
        sa.Column("changed_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("reason", sa.Text(), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False, server_default=sa.text("now()")),
        schema=SCHEMA,
    )
    op.create_index("ix_svc_request_status_hist_request", "svc_service_request_status_history", ["request_id"], schema=SCHEMA)

    # Attachments
    op.create_table(
        "svc_service_request_attachment",
        sa.Column("id", UUID(as_uuid=True), primary_key=True),
        sa.Column("tenant_id", UUID(as_uuid=True), nullable=False),
        sa.Column("company_id", UUID(as_uuid=True), nullable=False),
        sa.Column("branch_id", UUID(as_uuid=True), nullable=True),
        sa.Column("request_id", UUID(as_uuid=True), sa.ForeignKey(f"{SCHEMA}.svc_service_request.id", ondelete="CASCADE"), nullable=False),
        sa.Column("file_name", sa.String(500), nullable=False),
        sa.Column("content_type", sa.String(200), nullable=True),
        sa.Column("file_path", sa.String(1000), nullable=False),
        sa.Column("file_size", sa.BigInteger(), nullable=True),
        sa.Column("uploaded_by", UUID(as_uuid=True), nullable=True),
        sa.Column("uploaded_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("status", sa.String(30), nullable=False, server_default="active"),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False, server_default=sa.text("now()")),
        sa.Column("created_by", UUID(as_uuid=True), nullable=True),
        sa.Column("is_deleted", sa.Boolean(), nullable=False, server_default=sa.text("false")),
        schema=SCHEMA,
    )
    op.create_index("ix_svc_request_attachment_request", "svc_service_request_attachment", ["request_id"], schema=SCHEMA)


def downgrade() -> None:
    op.drop_table("svc_service_request_attachment", schema=SCHEMA)
    op.drop_table("svc_service_request_status_history", schema=SCHEMA)
    op.drop_table("svc_service_oem_support", schema=SCHEMA)
    op.drop_table("svc_service_field_engineer_visit", schema=SCHEMA)
    op.drop_table("svc_service_request_comment", schema=SCHEMA)

    sop_col_names = [
        "mode_of_action", "contact_name", "email", "alternate_email", "mobile",
        "owner_employee_id", "product_id", "contact_id", "software_version",
        "issue_description", "reference_sr_number", "customer_reference", "lsi",
        "end_customer_name", "end_customer_email", "coordinator_name", "coordinator_phone",
        "end_customer_street", "end_customer_state", "end_customer_city",
        "end_customer_city_type", "end_customer_other_city", "end_customer_gst",
        "end_customer_postal_code", "start_work_date", "classification",
        "escalation_reason", "next_plan", "additional_description", "oem_support_enabled",
        "asset_name", "serial_number", "warranty_start_date", "warranty_end_date",
        "amc_end_date", "asset_status", "amc_mail_sent", "ticket_category",
    ]
    for name in sop_col_names:
        op.drop_column("svc_service_request", name, schema=SCHEMA)

    op.drop_constraint("ck_svc_service_request_status", "svc_service_request", schema=SCHEMA, type_="check")
    op.create_check_constraint(
        "ck_svc_service_request_status",
        "svc_service_request",
        "status IN ('draft','submitted','approved','new','assigned','in_progress','resolved','closed','cancelled')",
        schema=SCHEMA,
    )
    op.drop_constraint("ck_svc_service_request_priority", "svc_service_request", schema=SCHEMA, type_="check")
    op.create_check_constraint(
        "ck_svc_service_request_priority",
        "svc_service_request",
        "priority IN ('low','medium','high','critical')",
        schema=SCHEMA,
    )
