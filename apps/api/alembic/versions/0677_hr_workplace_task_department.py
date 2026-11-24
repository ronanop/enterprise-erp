"""Add department assignment fields to workplace tasks."""

from collections.abc import Sequence

from alembic import op

revision: str = "0677_hr_workplace_task_department"
down_revision: str | Sequence[str] | None = "0676_hr_workplace_task"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    op.execute(
        """
        ALTER TABLE hr.hr_workplace_task
          ADD COLUMN IF NOT EXISTS assignment_mode VARCHAR(20) NOT NULL DEFAULT 'users';
        """
    )
    op.execute(
        """
        ALTER TABLE hr.hr_workplace_task
          ADD COLUMN IF NOT EXISTS department_id UUID NULL;
        """
    )
    op.execute(
        """
        DO $$
        BEGIN
          IF NOT EXISTS (
            SELECT 1 FROM pg_constraint
            WHERE conname = 'ck_hr_workplace_task_assignment_mode'
          ) THEN
            ALTER TABLE hr.hr_workplace_task
              ADD CONSTRAINT ck_hr_workplace_task_assignment_mode
              CHECK (assignment_mode IN ('users','department'));
          END IF;
        END $$;
        """
    )
    op.execute(
        """
        DO $$
        BEGIN
          IF NOT EXISTS (
            SELECT 1 FROM pg_constraint
            WHERE conname = 'fk_hr_workplace_task_department'
          ) THEN
            ALTER TABLE hr.hr_workplace_task
              ADD CONSTRAINT fk_hr_workplace_task_department
              FOREIGN KEY (department_id)
              REFERENCES organization.org_department(id)
              ON DELETE SET NULL;
          END IF;
        END $$;
        """
    )
    op.execute(
        """
        CREATE INDEX IF NOT EXISTS ix_hr_workplace_task_department_id
          ON hr.hr_workplace_task (department_id);
        """
    )
    op.execute(
        """
        CREATE INDEX IF NOT EXISTS ix_hr_workplace_task_assignment_mode
          ON hr.hr_workplace_task (assignment_mode);
        """
    )


def downgrade() -> None:
    op.execute(
        "ALTER TABLE hr.hr_workplace_task DROP CONSTRAINT IF EXISTS fk_hr_workplace_task_department"
    )
    op.execute(
        "ALTER TABLE hr.hr_workplace_task DROP CONSTRAINT IF EXISTS ck_hr_workplace_task_assignment_mode"
    )
    op.execute(
        "DROP INDEX IF EXISTS hr.ix_hr_workplace_task_department_id"
    )
    op.execute(
        "DROP INDEX IF EXISTS hr.ix_hr_workplace_task_assignment_mode"
    )
    op.execute(
        "ALTER TABLE hr.hr_workplace_task DROP COLUMN IF EXISTS department_id"
    )
    op.execute(
        "ALTER TABLE hr.hr_workplace_task DROP COLUMN IF EXISTS assignment_mode"
    )
