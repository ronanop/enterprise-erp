"""Add optional tagged internal member on CRM meetings."""

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

revision: str = "0452_crm_meeting_tagged"
down_revision: str | None = "0451_crm_task_assignment"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    add_column_if_missing(
        "crm_meeting",
        sa.Column("tagged_employee_id", sa.UUID(), nullable=True),
        schema="crm",
    )
    create_fk_if_missing(
        "fk_crm_meeting_tagged_employee",
        "crm_meeting",
        "master_employee",
        ["tagged_employee_id"],
        ["id"],
        source_schema="crm",
        referent_schema="master",
        ondelete="RESTRICT",
    )
    create_index_if_missing(
        "ix_crm_meeting_tagged_employee_id",
        "crm_meeting",
        ["tagged_employee_id"],
        schema="crm",
    )


def downgrade() -> None:
    op.drop_index("ix_crm_meeting_tagged_employee_id", table_name="crm_meeting", schema="crm")
    op.drop_constraint(
        "fk_crm_meeting_tagged_employee", "crm_meeting", schema="crm", type_="foreignkey"
    )
    op.drop_column("crm_meeting", "tagged_employee_id", schema="crm")
