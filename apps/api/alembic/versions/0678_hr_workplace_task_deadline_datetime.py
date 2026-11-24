"""Store workplace task deadline as timestamp (date + time)."""

from collections.abc import Sequence

from alembic import op

revision: str = "0678_hr_workplace_task_deadline_datetime"
down_revision: str | Sequence[str] | None = "0677_hr_workplace_task_department"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    op.execute(
        """
        ALTER TABLE hr.hr_workplace_task
          ALTER COLUMN deadline TYPE TIMESTAMPTZ
          USING CASE
            WHEN deadline IS NULL THEN NULL
            ELSE deadline::timestamp AT TIME ZONE 'UTC'
          END;
        """
    )


def downgrade() -> None:
    op.execute(
        """
        ALTER TABLE hr.hr_workplace_task
          ALTER COLUMN deadline TYPE DATE
          USING (deadline AT TIME ZONE 'UTC')::date;
        """
    )
