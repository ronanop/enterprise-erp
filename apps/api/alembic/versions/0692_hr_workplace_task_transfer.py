"""Allow transferred status on workplace-task assignees."""

from __future__ import annotations

from collections.abc import Sequence

import sqlalchemy as sa
from alembic import op

revision: str = "0692_hr_workplace_task_transfer"
down_revision: str | None = "0691_hr_workplace_task"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    op.drop_constraint(
        "ck_hr_workplace_task_assignee_status",
        "hr_workplace_task_assignee",
        schema="hr",
        type_="check",
    )
    op.create_check_constraint(
        "ck_hr_workplace_task_assignee_status",
        "hr_workplace_task_assignee",
        "status IN ("
        "'assigned','accepted','declined','transferred','started','in_progress',"
        "'pending_verification','redo_requested','completed'"
        ")",
        schema="hr",
    )


def downgrade() -> None:
    op.execute(
        sa.text(
            "UPDATE hr.hr_workplace_task_assignee "
            "SET status = 'declined' WHERE status = 'transferred'"
        )
    )
    op.drop_constraint(
        "ck_hr_workplace_task_assignee_status",
        "hr_workplace_task_assignee",
        schema="hr",
        type_="check",
    )
    op.create_check_constraint(
        "ck_hr_workplace_task_assignee_status",
        "hr_workplace_task_assignee",
        "status IN ("
        "'assigned','accepted','declined','started','in_progress',"
        "'pending_verification','redo_requested','completed'"
        ")",
        schema="hr",
    )
