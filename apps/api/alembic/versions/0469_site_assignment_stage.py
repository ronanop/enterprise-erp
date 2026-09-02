"""Add assignment workflow stage between intake and survey."""

from collections.abc import Sequence

import sqlalchemy as sa
from alembic import op

revision: str = "0469_site_assignment_stage"
down_revision: str | None = "0468_site_stage_assignees"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None

TABLE = "prj_site_installation"
SCHEMA = "project"

NEW_STAGES = (
    "intake",
    "assignment",
    "survey",
    "scm",
    "installation",
    "configuration",
    "acceptance",
    "completed",
)

OLD_STAGES = (
    "intake",
    "survey",
    "scm",
    "installation",
    "configuration",
    "acceptance",
    "completed",
)


def upgrade() -> None:
    op.drop_constraint("ck_prj_site_workflow_stage", TABLE, schema=SCHEMA, type_="check")
    # Projects still at Survey without owners go back to Assignment (new step 2).
    op.execute(
        sa.text(
            f"""
            UPDATE {SCHEMA}.{TABLE}
            SET workflow_stage = 'assignment'
            WHERE workflow_stage = 'survey'
              AND survey_assignee_employee_id IS NULL
              AND scm_assignee_employee_id IS NULL
              AND installation_assignee_employee_id IS NULL
              AND acceptance_assignee_employee_id IS NULL
            """
        )
    )
    stages = ", ".join(f"'{s}'" for s in NEW_STAGES)
    op.create_check_constraint(
        "ck_prj_site_workflow_stage",
        TABLE,
        f"workflow_stage IN ({stages})",
        schema=SCHEMA,
    )


def downgrade() -> None:
    op.execute(
        sa.text(
            f"""
            UPDATE {SCHEMA}.{TABLE}
            SET workflow_stage = 'survey'
            WHERE workflow_stage = 'assignment'
            """
        )
    )
    op.drop_constraint("ck_prj_site_workflow_stage", TABLE, schema=SCHEMA, type_="check")
    stages = ", ".join(f"'{s}'" for s in OLD_STAGES)
    op.create_check_constraint(
        "ck_prj_site_workflow_stage",
        TABLE,
        f"workflow_stage IN ({stages})",
        schema=SCHEMA,
    )
