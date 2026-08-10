"""Email ingest log for email-to-ticket automation."""

from collections.abc import Sequence

import sqlalchemy as sa
from alembic import op
from sqlalchemy.dialects.postgresql import UUID

revision: str = "0475_svc_email_ingest"
down_revision: str | None = "0474_svc_child_soft_del"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None

SCHEMA = "service"


def upgrade() -> None:
    op.create_table(
        "svc_email_ingest_log",
        sa.Column("id", UUID(as_uuid=True), primary_key=True),
        sa.Column("tenant_id", UUID(as_uuid=True), nullable=False),
        sa.Column("company_id", UUID(as_uuid=True), nullable=False),
        sa.Column("message_id", sa.String(512), nullable=False),
        sa.Column("from_address", sa.String(255), nullable=False),
        sa.Column("subject", sa.String(500), nullable=True),
        sa.Column("request_id", UUID(as_uuid=True), nullable=True),
        sa.Column("status", sa.String(30), nullable=False, server_default="processed"),
        sa.Column("error_message", sa.Text(), nullable=True),
        sa.Column("source", sa.String(30), nullable=False, server_default="webhook"),
        sa.Column("received_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("processed_at", sa.DateTime(timezone=True), nullable=False),
        sa.UniqueConstraint("message_id", name="uk_svc_email_ingest_message_id"),
        sa.CheckConstraint(
            "status IN ('processed','duplicate','failed','skipped')",
            name="ck_svc_email_ingest_status",
        ),
        schema=SCHEMA,
    )
    op.create_index("ix_svc_email_ingest_tenant", "svc_email_ingest_log", ["tenant_id"], schema=SCHEMA)
    op.create_index("ix_svc_email_ingest_company", "svc_email_ingest_log", ["company_id"], schema=SCHEMA)
    op.create_index("ix_svc_email_ingest_request", "svc_email_ingest_log", ["request_id"], schema=SCHEMA)


def downgrade() -> None:
    op.drop_table("svc_email_ingest_log", schema=SCHEMA)
