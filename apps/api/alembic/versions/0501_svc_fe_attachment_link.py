"""Link ticket attachments to field engineer work reports."""

from __future__ import annotations

from collections.abc import Sequence

import sqlalchemy as sa
from alembic import op
from sqlalchemy.dialects import postgresql

revision: str = "0501_svc_fe_attachment_link"
down_revision: str | None = "0500_svc_fe_visibility"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    op.add_column(
        "svc_service_request_attachment",
        sa.Column("field_engineer_id", postgresql.UUID(as_uuid=True), nullable=True),
        schema="service",
    )
    op.create_foreign_key(
        "fk_svc_attachment_field_engineer",
        "svc_service_request_attachment",
        "svc_ticket_field_engineer",
        ["field_engineer_id"],
        ["id"],
        source_schema="service",
        referent_schema="service",
        ondelete="SET NULL",
    )
    op.create_index(
        "ix_svc_attachment_field_engineer_id",
        "svc_service_request_attachment",
        ["field_engineer_id"],
        unique=False,
        schema="service",
    )


def downgrade() -> None:
    op.drop_index("ix_svc_attachment_field_engineer_id", table_name="svc_service_request_attachment", schema="service")
    op.drop_constraint("fk_svc_attachment_field_engineer", "svc_service_request_attachment", schema="service", type_="foreignkey")
    op.drop_column("svc_service_request_attachment", "field_engineer_id", schema="service")
