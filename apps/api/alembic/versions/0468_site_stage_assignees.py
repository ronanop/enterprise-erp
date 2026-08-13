"""Add per-stage assignee employee columns for site installation."""

import sys
from collections.abc import Sequence
from pathlib import Path

import sqlalchemy as sa
from alembic import op
from sqlalchemy.dialects import postgresql

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))

from helpers import add_column_if_missing, create_fk_if_missing, create_index_if_missing  # noqa: E402

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
        add_column_if_missing(
            TABLE,
            sa.Column(name, postgresql.UUID(as_uuid=True), nullable=True),
            schema=SCHEMA,
        )
        create_fk_if_missing(
            f"fk_{TABLE}_{name}_master_employee",
            TABLE,
            "master_employee",
            [name],
            ["id"],
            source_schema=SCHEMA,
            referent_schema="master",
            ondelete="RESTRICT",
        )
        create_index_if_missing(
            f"ix_{TABLE}_{name}",
            TABLE,
            [name],
            schema=SCHEMA,
        )


def downgrade() -> None:
    for name in reversed(COLUMNS):
        op.drop_index(f"ix_{TABLE}_{name}", table_name=TABLE, schema=SCHEMA)
        op.drop_column(TABLE, name, schema=SCHEMA)
