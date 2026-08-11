"""Create training rooms / requests and extend hr_training schedule fields."""

import sys
from collections.abc import Sequence
from pathlib import Path

import sqlalchemy as sa
from alembic import op
from sqlalchemy import inspect
from sqlalchemy.dialects import postgresql

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))

from helpers import (  # noqa: E402
    add_column_if_missing,
    create_fk_if_missing,
    create_index_if_missing,
)

revision: str = "0473_hr_training_rooms_requests"
down_revision: str | None = "0472_vascan_checkbox_date"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    op.create_table(
        "hr_training_room",
        sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True, nullable=False),
        sa.Column("tenant_id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("company_id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("branch_id", postgresql.UUID(as_uuid=True), nullable=True),
        sa.Column("room_code", sa.String(50), nullable=False),
        sa.Column("room_name", sa.String(255), nullable=False),
        sa.Column("capacity", sa.Integer(), nullable=False, server_default="10"),
        sa.Column("equipment_json", postgresql.JSONB(), nullable=True),
        sa.Column("notes", sa.Text(), nullable=True),
        sa.Column("status", sa.String(30), nullable=False, server_default="active"),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("created_by", postgresql.UUID(as_uuid=True), nullable=True),
        sa.Column("updated_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("updated_by", postgresql.UUID(as_uuid=True), nullable=True),
        sa.Column("is_deleted", sa.Boolean(), nullable=False, server_default=sa.text("false")),
        sa.Column("deleted_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("deleted_by", postgresql.UUID(as_uuid=True), nullable=True),
        sa.Column("version", sa.Integer(), nullable=False, server_default="1"),
        sa.ForeignKeyConstraint(["branch_id"], ["organization.org_branch.id"], ondelete="RESTRICT"),
        sa.UniqueConstraint("company_id", "room_code", name="uk_hr_trn_room_company_code"),
        sa.CheckConstraint("status IN ('active','inactive','maintenance')", name="ck_hr_trn_room_status"),
        schema="hr",
    )
    op.create_index("ix_hr_trn_room_branch", "hr_training_room", ["branch_id"], schema="hr")
    op.create_index("ix_hr_trn_room_status", "hr_training_room", ["status"], schema="hr")

    add_column_if_missing("hr_training", sa.Column("start_time", sa.Time(), nullable=True), schema="hr")
    add_column_if_missing("hr_training", sa.Column("end_time", sa.Time(), nullable=True), schema="hr")
    add_column_if_missing(
        "hr_training",
        sa.Column("room_id", postgresql.UUID(as_uuid=True), nullable=True),
        schema="hr",
    )
    add_column_if_missing(
        "hr_training",
        sa.Column("is_recurring", sa.Boolean(), nullable=False, server_default=sa.text("false")),
        schema="hr",
    )
    add_column_if_missing(
        "hr_training", sa.Column("recurrence_rule", sa.String(50), nullable=True), schema="hr"
    )
    add_column_if_missing("hr_training", sa.Column("notes", sa.Text(), nullable=True), schema="hr")

    bind = op.get_bind()
    checks = {
        c["name"]
        for c in inspect(bind).get_check_constraints("hr_training", schema="hr")
    }
    if "ck_hr_trn_recurrence" not in checks:
        op.create_check_constraint(
            "ck_hr_trn_recurrence",
            "hr_training",
            "recurrence_rule IS NULL OR recurrence_rule IN ('none','daily','weekly','monthly')",
            schema="hr",
        )

    create_fk_if_missing(
        "fk_hr_trn_room",
        "hr_training",
        "hr_training_room",
        ["room_id"],
        ["id"],
        source_schema="hr",
        referent_schema="hr",
        ondelete="RESTRICT",
    )
    create_index_if_missing("ix_hr_trn_room_id", "hr_training", ["room_id"], schema="hr")

    op.create_table(
        "hr_training_request",
        sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True, nullable=False),
        sa.Column("tenant_id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("company_id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("branch_id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("request_code", sa.String(50), nullable=False),
        sa.Column("title", sa.String(255), nullable=False),
        sa.Column("request_type", sa.String(30), nullable=False, server_default="meeting"),
        sa.Column("requested_by_employee_id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("host_employee_id", postgresql.UUID(as_uuid=True), nullable=True),
        sa.Column("host_name", sa.String(255), nullable=True),
        sa.Column("room_id", postgresql.UUID(as_uuid=True), nullable=True),
        sa.Column("training_id", postgresql.UUID(as_uuid=True), nullable=True),
        sa.Column("request_date", sa.Date(), nullable=False),
        sa.Column("start_time", sa.Time(), nullable=True),
        sa.Column("end_time", sa.Time(), nullable=True),
        sa.Column("is_recurring", sa.Boolean(), nullable=False, server_default=sa.text("false")),
        sa.Column("recurrence_rule", sa.String(50), nullable=True),
        sa.Column("attendees_json", postgresql.JSONB(), nullable=True),
        sa.Column("agenda", sa.Text(), nullable=True),
        sa.Column("approval_notes", sa.Text(), nullable=True),
        sa.Column("status", sa.String(30), nullable=False, server_default="submitted"),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("created_by", postgresql.UUID(as_uuid=True), nullable=True),
        sa.Column("updated_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("updated_by", postgresql.UUID(as_uuid=True), nullable=True),
        sa.Column("is_deleted", sa.Boolean(), nullable=False, server_default=sa.text("false")),
        sa.Column("deleted_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("deleted_by", postgresql.UUID(as_uuid=True), nullable=True),
        sa.Column("version", sa.Integer(), nullable=False, server_default="1"),
        sa.ForeignKeyConstraint(
            ["requested_by_employee_id"], ["master.master_employee.id"], ondelete="RESTRICT"
        ),
        sa.ForeignKeyConstraint(
            ["host_employee_id"], ["master.master_employee.id"], ondelete="RESTRICT"
        ),
        sa.ForeignKeyConstraint(["room_id"], ["hr.hr_training_room.id"], ondelete="RESTRICT"),
        sa.ForeignKeyConstraint(["training_id"], ["hr.hr_training.id"], ondelete="RESTRICT"),
        sa.UniqueConstraint("company_id", "request_code", name="uk_hr_trn_req_company_code"),
        sa.CheckConstraint(
            "request_type IN ('training','meeting','workshop')", name="ck_hr_trn_req_type"
        ),
        sa.CheckConstraint(
            "status IN ('draft','submitted','approved','rejected','cancelled')",
            name="ck_hr_trn_req_status",
        ),
        schema="hr",
    )
    op.create_index("ix_hr_trn_req_date", "hr_training_request", ["request_date"], schema="hr")
    op.create_index("ix_hr_trn_req_status", "hr_training_request", ["status"], schema="hr")


def downgrade() -> None:
    op.drop_table("hr_training_request", schema="hr")
    op.drop_constraint("fk_hr_trn_room", "hr_training", schema="hr", type_="foreignkey")
    op.drop_index("ix_hr_trn_room_id", table_name="hr_training", schema="hr")
    op.drop_column("hr_training", "notes", schema="hr")
    op.drop_column("hr_training", "recurrence_rule", schema="hr")
    op.drop_column("hr_training", "is_recurring", schema="hr")
    op.drop_column("hr_training", "room_id", schema="hr")
    op.drop_column("hr_training", "end_time", schema="hr")
    op.drop_column("hr_training", "start_time", schema="hr")
    op.drop_table("hr_training_room", schema="hr")
