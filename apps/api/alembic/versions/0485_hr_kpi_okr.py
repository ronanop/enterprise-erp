"""KPI + OKR / overday allotment migration — PMS definitions."""

from collections.abc import Sequence

import sqlalchemy as sa
from alembic import op
from sqlalchemy.dialects import postgresql

revision: str = "0485_hr_kpi_okr"
down_revision: str | None = "0484_hr_onduty_ot_allot"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    op.create_table(
        "hr_kpi",
        sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True, nullable=False),
        sa.Column("tenant_id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("company_id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("branch_id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("name", sa.String(255), nullable=False),
        sa.Column("department", sa.String(255), nullable=False, server_default=""),
        sa.Column("designation", sa.String(255), nullable=True),
        sa.Column("weightage", sa.Numeric(5, 2), nullable=False, server_default="0"),
        sa.Column("target", sa.Numeric(18, 4), nullable=False, server_default="0"),
        sa.Column("measure_type", sa.String(30), nullable=False, server_default="number"),
        sa.Column("rating_scale", sa.Integer(), nullable=False, server_default="5"),
        sa.Column("status", sa.String(30), nullable=False, server_default="active"),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False, server_default=sa.text("now()")),
        sa.Column("updated_at", sa.DateTime(timezone=True), nullable=False, server_default=sa.text("now()")),
        sa.Column("created_by", postgresql.UUID(as_uuid=True), nullable=True),
        sa.Column("updated_by", postgresql.UUID(as_uuid=True), nullable=True),
        sa.Column("is_deleted", sa.Boolean(), nullable=False, server_default=sa.text("false")),
        sa.Column("deleted_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("deleted_by", postgresql.UUID(as_uuid=True), nullable=True),
        sa.Column("version", sa.Integer(), nullable=False, server_default="1"),
        sa.CheckConstraint(
            "measure_type IN ('percentage','number','currency','rating')",
            name="ck_hr_kpi_measure",
        ),
        sa.CheckConstraint("status IN ('active','inactive')", name="ck_hr_kpi_status"),
        schema="hr",
    )
    op.create_index("ix_hr_kpi_status", "hr_kpi", ["status"], schema="hr")
    op.create_index("ix_hr_kpi_department", "hr_kpi", ["department"], schema="hr")

    op.create_table(
        "hr_okr",
        sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True, nullable=False),
        sa.Column("tenant_id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("company_id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("branch_id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("title", sa.String(255), nullable=False),
        sa.Column("owner", sa.String(255), nullable=False, server_default=""),
        sa.Column("department", sa.String(255), nullable=False, server_default=""),
        sa.Column("weightage", sa.Numeric(5, 2), nullable=False, server_default="0"),
        sa.Column("progress_pct", sa.Numeric(5, 2), nullable=False, server_default="0"),
        sa.Column("status", sa.String(30), nullable=False, server_default="active"),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False, server_default=sa.text("now()")),
        sa.Column("updated_at", sa.DateTime(timezone=True), nullable=False, server_default=sa.text("now()")),
        sa.Column("created_by", postgresql.UUID(as_uuid=True), nullable=True),
        sa.Column("updated_by", postgresql.UUID(as_uuid=True), nullable=True),
        sa.Column("is_deleted", sa.Boolean(), nullable=False, server_default=sa.text("false")),
        sa.Column("deleted_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("deleted_by", postgresql.UUID(as_uuid=True), nullable=True),
        sa.Column("version", sa.Integer(), nullable=False, server_default="1"),
        sa.CheckConstraint("status IN ('active','inactive','closed')", name="ck_hr_okr_status"),
        schema="hr",
    )
    op.create_index("ix_hr_okr_status", "hr_okr", ["status"], schema="hr")

    op.create_table(
        "hr_okr_key_result",
        sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True, nullable=False),
        sa.Column("tenant_id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("company_id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("branch_id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("okr_id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("title", sa.String(255), nullable=False),
        sa.Column("progress_pct", sa.Numeric(5, 2), nullable=False, server_default="0"),
        sa.Column("weightage", sa.Numeric(5, 2), nullable=False, server_default="1"),
        sa.Column("sequence_no", sa.Integer(), nullable=False, server_default="1"),
        sa.Column("status", sa.String(30), nullable=False, server_default="active"),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False, server_default=sa.text("now()")),
        sa.Column("updated_at", sa.DateTime(timezone=True), nullable=False, server_default=sa.text("now()")),
        sa.Column("created_by", postgresql.UUID(as_uuid=True), nullable=True),
        sa.Column("updated_by", postgresql.UUID(as_uuid=True), nullable=True),
        sa.Column("is_deleted", sa.Boolean(), nullable=False, server_default=sa.text("false")),
        sa.Column("deleted_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("deleted_by", postgresql.UUID(as_uuid=True), nullable=True),
        sa.Column("version", sa.Integer(), nullable=False, server_default="1"),
        sa.ForeignKeyConstraint(["okr_id"], ["hr.hr_okr.id"], ondelete="CASCADE"),
        sa.CheckConstraint("status IN ('active','inactive')", name="ck_hr_okr_kr_status"),
        schema="hr",
    )
    op.create_index("ix_hr_okr_kr_okr", "hr_okr_key_result", ["okr_id"], schema="hr")


def downgrade() -> None:
    op.drop_table("hr_okr_key_result", schema="hr")
    op.drop_table("hr_okr", schema="hr")
    op.drop_table("hr_kpi", schema="hr")
