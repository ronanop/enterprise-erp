"""Add workplace task proof files and verification fields."""

from collections.abc import Sequence

from alembic import op

revision: str = "0679_hr_workplace_task_proof"
down_revision: str | Sequence[str] | None = "0678_hr_workplace_task_deadline_datetime"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    op.execute(
        """
        ALTER TABLE hr.hr_workplace_task_assignee
          DROP CONSTRAINT IF EXISTS ck_hr_workplace_task_assignee_status;
        """
    )
    op.execute(
        """
        ALTER TABLE hr.hr_workplace_task_assignee
          ADD CONSTRAINT ck_hr_workplace_task_assignee_status
          CHECK (
            status IN (
              'assigned','accepted','declined','started','in_progress',
              'pending_verification','redo_requested','completed'
            )
          );
        """
    )
    op.execute(
        """
        ALTER TABLE hr.hr_workplace_task_assignee
          ADD COLUMN IF NOT EXISTS review_note TEXT NOT NULL DEFAULT '';
        """
    )
    op.execute(
        """
        ALTER TABLE hr.hr_workplace_task_assignee
          ADD COLUMN IF NOT EXISTS submitted_at TIMESTAMPTZ NULL;
        """
    )
    op.execute(
        """
        ALTER TABLE hr.hr_workplace_task_assignee
          ADD COLUMN IF NOT EXISTS verified_at TIMESTAMPTZ NULL;
        """
    )
    op.execute(
        """
        ALTER TABLE hr.hr_workplace_task_assignee
          ADD COLUMN IF NOT EXISTS verified_by_employee_id UUID NULL;
        """
    )
    op.execute(
        """
        DO $$
        BEGIN
          IF NOT EXISTS (
            SELECT 1 FROM pg_constraint
            WHERE conname = 'fk_hr_workplace_task_assignee_verified_by'
          ) THEN
            ALTER TABLE hr.hr_workplace_task_assignee
              ADD CONSTRAINT fk_hr_workplace_task_assignee_verified_by
              FOREIGN KEY (verified_by_employee_id)
              REFERENCES master.master_employee (id)
              ON DELETE SET NULL;
          END IF;
        END $$;
        """
    )
    op.execute(
        """
        CREATE INDEX IF NOT EXISTS ix_hr_workplace_task_assignee_verified_by
          ON hr.hr_workplace_task_assignee (verified_by_employee_id);
        """
    )
    op.execute(
        """
        CREATE TABLE IF NOT EXISTS hr.hr_workplace_task_proof (
          id UUID PRIMARY KEY,
          tenant_id UUID NOT NULL,
          company_id UUID NOT NULL,
          branch_id UUID NOT NULL,
          task_id UUID NOT NULL
            REFERENCES hr.hr_workplace_task (id) ON DELETE CASCADE,
          assignee_id UUID NOT NULL
            REFERENCES hr.hr_workplace_task_assignee (id) ON DELETE CASCADE,
          storage_uri VARCHAR(1000) NOT NULL,
          file_name VARCHAR(255) NOT NULL,
          content_type VARCHAR(120) NOT NULL DEFAULT '',
          byte_size INTEGER NOT NULL DEFAULT 0,
          uploaded_by_employee_id UUID NOT NULL
            REFERENCES master.master_employee (id) ON DELETE RESTRICT,
          note TEXT NOT NULL DEFAULT '',
          created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
          created_by UUID NULL,
          updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
          updated_by UUID NULL,
          version INTEGER NOT NULL DEFAULT 1,
          is_deleted BOOLEAN NOT NULL DEFAULT FALSE,
          deleted_at TIMESTAMPTZ NULL,
          deleted_by UUID NULL
        );
        """
    )
    op.execute(
        """
        CREATE INDEX IF NOT EXISTS ix_hr_workplace_task_proof_task_id
          ON hr.hr_workplace_task_proof (task_id);
        """
    )
    op.execute(
        """
        CREATE INDEX IF NOT EXISTS ix_hr_workplace_task_proof_assignee_id
          ON hr.hr_workplace_task_proof (assignee_id);
        """
    )
    op.execute(
        """
        CREATE INDEX IF NOT EXISTS ix_hr_workplace_task_proof_uploaded_by
          ON hr.hr_workplace_task_proof (uploaded_by_employee_id);
        """
    )
    op.execute(
        """
        CREATE INDEX IF NOT EXISTS ix_hr_workplace_task_proof_tenant
          ON hr.hr_workplace_task_proof (tenant_id);
        """
    )


def downgrade() -> None:
    op.execute("DROP TABLE IF EXISTS hr.hr_workplace_task_proof;")
    op.execute(
        """
        ALTER TABLE hr.hr_workplace_task_assignee
          DROP CONSTRAINT IF EXISTS fk_hr_workplace_task_assignee_verified_by;
        """
    )
    op.execute(
        """
        DROP INDEX IF EXISTS hr.ix_hr_workplace_task_assignee_verified_by;
        """
    )
    op.execute(
        """
        ALTER TABLE hr.hr_workplace_task_assignee
          DROP COLUMN IF EXISTS verified_by_employee_id,
          DROP COLUMN IF EXISTS verified_at,
          DROP COLUMN IF EXISTS submitted_at,
          DROP COLUMN IF EXISTS review_note;
        """
    )
    op.execute(
        """
        ALTER TABLE hr.hr_workplace_task_assignee
          DROP CONSTRAINT IF EXISTS ck_hr_workplace_task_assignee_status;
        """
    )
    op.execute(
        """
        ALTER TABLE hr.hr_workplace_task_assignee
          ADD CONSTRAINT ck_hr_workplace_task_assignee_status
          CHECK (
            status IN (
              'assigned','accepted','declined','started','in_progress','completed'
            )
          );
        """
    )
