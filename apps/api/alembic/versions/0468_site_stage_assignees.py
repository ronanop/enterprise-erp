"""Add per-stage assignee employee columns for site installation."""

from collections.abc import Sequence

import sqlalchemy as sa
from alembic import op
from sqlalchemy.dialects import postgresql

revision: str = "0468_site_stage_assignees"
down_revision: str | None = "0467_accept_checkbox_dates"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None

TABLE = "prj_site_installation"
SCHEMA = "project"

COLUMNS = (
    "survey_assignee_employee_id",
    "scm_assignee_employee_id",
    "installation_assignee_employee_id",
    "configuration_assignee_employee_id",
    "acceptance_assignee_employee_id",
)


def upgrade() -> None:
    for name in COLUMNS:
        op.add_column(
            TABLE,
            sa.Column(
                name,
                postgresql.UUID(as_uuid=True),
                sa.ForeignKey("master.master_employee.id", ondelete="RESTRICT"),
                nullable=True,
            ),
            schema=SCHEMA,
        )
        op.create_index(
            f"ix_{TABLE}_{name}",
            TABLE,
            [name],
            schema=SCHEMA,
        )


def downgrade() -> None:
    for name in reversed(COLUMNS):
        op.drop_index(f"ix_{TABLE}_{name}", table_name=TABLE, schema=SCHEMA)
        op.drop_column(TABLE, name, schema=SCHEMA)
