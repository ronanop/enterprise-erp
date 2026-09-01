"""Multi field engineers on tickets + FE solve workflow."""

from __future__ import annotations

from collections.abc import Sequence

import sqlalchemy as sa
from alembic import op
from sqlalchemy.dialects.postgresql import UUID as PG_UUID

revision: str = "0497_svc_field_engineers"
down_revision: str | None = "0496_svc_notebook_enhancements"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    op.create_table(
        "svc_ticket_field_engineer",
        sa.Column("id", PG_UUID(as_uuid=True), primary_key=True),
        sa.Column("tenant_id", PG_UUID(as_uuid=True), sa.ForeignKey("foundation.sec_tenant.id"), nullable=False),
        sa.Column("company_id", PG_UUID(as_uuid=True), sa.ForeignKey("organization.org_company.id"), nullable=False),
        sa.Column("branch_id", PG_UUID(as_uuid=True), sa.ForeignKey("organization.org_branch.id"), nullable=True),
        sa.Column(
            "request_id",
            PG_UUID(as_uuid=True),
            sa.ForeignKey("service.svc_service_request.id", ondelete="CASCADE"),
            nullable=False,
        ),
        sa.Column("engineer_name", sa.String(255), nullable=False),
        sa.Column("engineer_contact", sa.String(50), nullable=True),
        sa.Column("engineer_email", sa.String(255), nullable=False),
        sa.Column("assigned_date", sa.Date(), nullable=True),
        sa.Column("solution_summary", sa.Text(), nullable=True),
        sa.Column("status", sa.String(30), nullable=False, server_default="assigned"),
        sa.Column("solved_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.text("now()"), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.text("now()"), nullable=False),
        sa.Column("created_by", PG_UUID(as_uuid=True), nullable=True),
        sa.Column("updated_by", PG_UUID(as_uuid=True), nullable=True),
        sa.Column("is_deleted", sa.Boolean(), nullable=False, server_default=sa.text("false")),
        sa.Column("deleted_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("deleted_by", PG_UUID(as_uuid=True), nullable=True),
        sa.Column("version", sa.Integer(), nullable=False, server_default="1"),
        sa.CheckConstraint("status IN ('assigned','solved')", name="ck_svc_ticket_fe_status"),
        schema="service",
    )
    op.create_index(
        "ix_svc_ticket_fe_request",
        "svc_ticket_field_engineer",
        ["request_id"],
        schema="service",
    )
    op.create_index(
        "ix_svc_ticket_fe_email",
        "svc_ticket_field_engineer",
        ["engineer_email"],
        schema="service",
    )

    # Mode/category on create may be blank until assigned engineer fills them
    op.execute(
        """
        ALTER TABLE service.svc_service_request
        ALTER COLUMN mode_of_action DROP NOT NULL
        """
    )


def downgrade() -> None:
    op.drop_table("svc_ticket_field_engineer", schema="service")
