"""Co-owners, stakeholders, and solution fields for service request tickets."""

from collections.abc import Sequence

import sqlalchemy as sa
from alembic import op
from sqlalchemy.dialects.postgresql import UUID

revision: str = "0591_svc_ticket_collab"
down_revision: str | None = "0590_svc_email_ingest"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None

SCHEMA = "service"


def upgrade() -> None:
    op.add_column(
        "svc_service_request",
        sa.Column("solution_summary", sa.Text(), nullable=True),
        schema=SCHEMA,
    )
    op.add_column(
        "svc_service_request",
        sa.Column("solution_type", sa.String(50), nullable=True),
        schema=SCHEMA,
    )
    op.add_column(
        "svc_service_request",
        sa.Column("resolved_at", sa.DateTime(timezone=True), nullable=True),
        schema=SCHEMA,
    )
    op.add_column(
        "svc_service_request",
        sa.Column("closed_at", sa.DateTime(timezone=True), nullable=True),
        schema=SCHEMA,
    )
    op.add_column(
        "svc_service_request",
        sa.Column("reopened_at", sa.DateTime(timezone=True), nullable=True),
        schema=SCHEMA,
    )
    op.add_column(
        "svc_service_request",
        sa.Column(
            "ownership_locked",
            sa.Boolean(),
            nullable=False,
            server_default=sa.text("false"),
        ),
        schema=SCHEMA,
    )

    op.create_table(
        "svc_service_request_co_owner",
        sa.Column("id", UUID(as_uuid=True), primary_key=True),
        sa.Column("tenant_id", UUID(as_uuid=True), nullable=False),
        sa.Column("company_id", UUID(as_uuid=True), nullable=False),
        sa.Column("branch_id", UUID(as_uuid=True), nullable=False),
        sa.Column("request_id", UUID(as_uuid=True), nullable=False),
        sa.Column("employee_id", UUID(as_uuid=True), nullable=False),
        sa.Column("added_by", UUID(as_uuid=True), nullable=True),
        sa.Column("added_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("is_deleted", sa.Boolean(), nullable=False, server_default=sa.text("false")),
        sa.Column("deleted_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("deleted_by", UUID(as_uuid=True), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False, server_default=sa.text("now()")),
        sa.Column("created_by", UUID(as_uuid=True), nullable=True),
        sa.Column("updated_at", sa.DateTime(timezone=True), nullable=False, server_default=sa.text("now()")),
        sa.Column("updated_by", UUID(as_uuid=True), nullable=True),
        sa.Column("version", sa.Integer(), nullable=False, server_default=sa.text("1")),
        sa.ForeignKeyConstraint(
            ["request_id"],
            [f"{SCHEMA}.svc_service_request.id"],
            name="fk_svc_request_co_owner_request",
            ondelete="CASCADE",
        ),
        sa.ForeignKeyConstraint(
            ["employee_id"],
            ["master.master_employee.id"],
            name="fk_svc_request_co_owner_employee",
            ondelete="RESTRICT",
        ),
        sa.UniqueConstraint("request_id", "employee_id", name="uk_svc_request_co_owner"),
        schema=SCHEMA,
    )
    op.create_index(
        "ix_svc_request_co_owner_request",
        "svc_service_request_co_owner",
        ["request_id"],
        schema=SCHEMA,
    )

    op.create_table(
        "svc_service_request_stakeholder",
        sa.Column("id", UUID(as_uuid=True), primary_key=True),
        sa.Column("tenant_id", UUID(as_uuid=True), nullable=False),
        sa.Column("company_id", UUID(as_uuid=True), nullable=False),
        sa.Column("branch_id", UUID(as_uuid=True), nullable=False),
        sa.Column("request_id", UUID(as_uuid=True), nullable=False),
        sa.Column("name", sa.String(255), nullable=False),
        sa.Column("email", sa.String(255), nullable=False),
        sa.Column("added_by", UUID(as_uuid=True), nullable=True),
        sa.Column("added_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("is_deleted", sa.Boolean(), nullable=False, server_default=sa.text("false")),
        sa.Column("deleted_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("deleted_by", UUID(as_uuid=True), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False, server_default=sa.text("now()")),
        sa.Column("created_by", UUID(as_uuid=True), nullable=True),
        sa.Column("updated_at", sa.DateTime(timezone=True), nullable=False, server_default=sa.text("now()")),
        sa.Column("updated_by", UUID(as_uuid=True), nullable=True),
        sa.Column("version", sa.Integer(), nullable=False, server_default=sa.text("1")),
        sa.ForeignKeyConstraint(
            ["request_id"],
            [f"{SCHEMA}.svc_service_request.id"],
            name="fk_svc_request_stakeholder_request",
            ondelete="CASCADE",
        ),
        sa.UniqueConstraint("request_id", "email", name="uk_svc_request_stakeholder_email"),
        schema=SCHEMA,
    )
    op.create_index(
        "ix_svc_request_stakeholder_request",
        "svc_service_request_stakeholder",
        ["request_id"],
        schema=SCHEMA,
    )


def downgrade() -> None:
    op.drop_index("ix_svc_request_stakeholder_request", table_name="svc_service_request_stakeholder", schema=SCHEMA)
    op.drop_table("svc_service_request_stakeholder", schema=SCHEMA)
    op.drop_index("ix_svc_request_co_owner_request", table_name="svc_service_request_co_owner", schema=SCHEMA)
    op.drop_table("svc_service_request_co_owner", schema=SCHEMA)
    for col in (
        "ownership_locked",
        "reopened_at",
        "closed_at",
        "resolved_at",
        "solution_type",
        "solution_summary",
    ):
        op.drop_column("svc_service_request", col, schema=SCHEMA)
