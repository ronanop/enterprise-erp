"""Merge configuration into installation workflow stage."""

from collections.abc import Sequence

import sqlalchemy as sa
from alembic import op

revision: str = "0470_merge_install_config_stage"
down_revision: str | None = "0469_site_assignment_stage"
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
    "acceptance",
    "completed",
)

OLD_STAGES = (
    "intake",
    "assignment",
    "survey",
    "scm",
    "installation",
    "configuration",
    "acceptance",
    "completed",
)


def upgrade() -> None:
    op.drop_constraint("ck_prj_site_workflow_stage", TABLE, schema=SCHEMA, type_="check")
    op.execute(
        sa.text(
            f"""
            UPDATE {SCHEMA}.{TABLE}
            SET workflow_stage = 'installation'
            WHERE workflow_stage = 'configuration'
            """
        )
    )
    op.execute(
        sa.text(
            f"""
            UPDATE {SCHEMA}.{TABLE}
            SET installation_assignee_employee_id = configuration_assignee_employee_id
            WHERE installation_assignee_employee_id IS NULL
              AND configuration_assignee_employee_id IS NOT NULL
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
    op.drop_constraint("ck_prj_site_workflow_stage", TABLE, schema=SCHEMA, type_="check")
    stages = ", ".join(f"'{s}'" for s in OLD_STAGES)
    op.create_check_constraint(
        "ck_prj_site_workflow_stage",
        TABLE,
        f"workflow_stage IN ({stages})",
        schema=SCHEMA,
    )
