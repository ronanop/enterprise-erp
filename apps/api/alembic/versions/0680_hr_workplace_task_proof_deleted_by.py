"""Add deleted_by to workplace task proof (SoftDeleteMixin)."""

from collections.abc import Sequence

from alembic import op

revision: str = "0680_hr_workplace_task_proof_deleted_by"
down_revision: str | Sequence[str] | None = "0679_hr_workplace_task_proof"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    op.execute(
        """
        ALTER TABLE hr.hr_workplace_task_proof
          ADD COLUMN IF NOT EXISTS deleted_by UUID NULL;
        """
    )


def downgrade() -> None:
    op.execute(
        """
        ALTER TABLE hr.hr_workplace_task_proof
          DROP COLUMN IF EXISTS deleted_by;
        """
    )
