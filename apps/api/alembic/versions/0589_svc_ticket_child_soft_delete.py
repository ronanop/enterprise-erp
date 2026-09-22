"""Add missing soft-delete columns to SOP child tables."""

from collections.abc import Sequence

import sqlalchemy as sa
from alembic import op
from sqlalchemy.dialects.postgresql import UUID

revision: str = "0589_svc_child_soft_del"
down_revision: str | None = "0588_svc_request_ticket_sop"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None

SCHEMA = "service"
TABLES = ("svc_service_field_engineer_visit", "svc_service_oem_support")


def upgrade() -> None:
    for table in TABLES:
        op.add_column(
            table,
            sa.Column("deleted_at", sa.DateTime(timezone=True), nullable=True),
            schema=SCHEMA,
        )
        op.add_column(
            table,
            sa.Column("deleted_by", UUID(as_uuid=True), nullable=True),
            schema=SCHEMA,
        )


def downgrade() -> None:
    for table in TABLES:
        op.drop_column(table, "deleted_by", schema=SCHEMA)
        op.drop_column(table, "deleted_at", schema=SCHEMA)
