"""Extend CRM tasks for opportunity team assignment fields."""

import sys
from collections.abc import Sequence
from pathlib import Path

import sqlalchemy as sa
from alembic import op

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))

from helpers import (  # noqa: E402
    add_column_if_missing,
    create_fk_if_missing,
    create_index_if_missing,
)

revision: str = "0451_crm_task_assignment"
down_revision: str | None = "0450_crm_followup_company"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    add_column_if_missing(
        "crm_task",
        sa.Column("assigned_to_employee_id", sa.UUID(), nullable=True),
        schema="crm",
    )
    add_column_if_missing(
        "crm_task",
        sa.Column("account_name", sa.String(length=255), nullable=True),
        schema="crm",
    )
    add_column_if_missing(
        "crm_task",
        sa.Column("opportunity_name", sa.String(length=255), nullable=True),
        schema="crm",
    )
    add_column_if_missing(
        "crm_task",
        sa.Column("reminder_date", sa.Date(), nullable=True),
        schema="crm",
    )
    add_column_if_missing(
        "crm_task",
        sa.Column("reminder_time", sa.Time(), nullable=True),
        schema="crm",
    )
    add_column_if_missing(
        "crm_task",
        sa.Column("email", sa.String(length=255), nullable=True),
        schema="crm",
    )
    add_column_if_missing(
        "crm_task",
        sa.Column("repeat_rule", sa.String(length=30), nullable=True),
        schema="crm",
    )
    create_fk_if_missing(
        "fk_crm_task_assigned_to_employee",
        "crm_task",
        "master_employee",
        ["assigned_to_employee_id"],
        ["id"],
        source_schema="crm",
        referent_schema="master",
        ondelete="RESTRICT",
    )
    create_index_if_missing(
        "ix_crm_task_assigned_to_employee_id",
        "crm_task",
        ["assigned_to_employee_id"],
        schema="crm",
    )
    op.drop_constraint("ck_crm_task_priority", "crm_task", schema="crm", type_="check")
    op.create_check_constraint(
        "ck_crm_task_priority",
        "crm_task",
        "priority IN ('highest','high','medium','low')",
        schema="crm",
    )


def downgrade() -> None:
    op.drop_constraint("ck_crm_task_priority", "crm_task", schema="crm", type_="check")
    op.create_check_constraint(
        "ck_crm_task_priority",
        "crm_task",
        "priority IN ('low','medium','high')",
        schema="crm",
    )
    op.drop_index("ix_crm_task_assigned_to_employee_id", table_name="crm_task", schema="crm")
    op.drop_constraint(
        "fk_crm_task_assigned_to_employee", "crm_task", schema="crm", type_="foreignkey"
    )
    op.drop_column("crm_task", "repeat_rule", schema="crm")
    op.drop_column("crm_task", "email", schema="crm")
    op.drop_column("crm_task", "reminder_time", schema="crm")
    op.drop_column("crm_task", "reminder_date", schema="crm")
    op.drop_column("crm_task", "opportunity_name", schema="crm")
    op.drop_column("crm_task", "account_name", schema="crm")
    op.drop_column("crm_task", "assigned_to_employee_id", schema="crm")
