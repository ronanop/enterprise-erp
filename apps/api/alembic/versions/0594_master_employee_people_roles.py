"""People-role flags on master_employee: hiring manager, recruiter, HR."""

from collections.abc import Sequence

import sqlalchemy as sa
from alembic import op

from helpers import add_column_if_missing, create_index_if_missing

revision: str = "0594_master_employee_people_roles"
down_revision: str | None = "0593_rec_pipeline_redesign"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    add_column_if_missing(
        "master_employee",
        sa.Column("is_hiring_manager", sa.Boolean(), nullable=False, server_default=sa.text("false")),
        schema="master",
    )
    add_column_if_missing(
        "master_employee",
        sa.Column("is_recruiter", sa.Boolean(), nullable=False, server_default=sa.text("false")),
        schema="master",
    )
    add_column_if_missing(
        "master_employee",
        sa.Column("is_hr", sa.Boolean(), nullable=False, server_default=sa.text("false")),
        schema="master",
    )
    create_index_if_missing(
        "ix_master_employee_is_hiring_manager",
        "master_employee",
        ["company_id", "is_hiring_manager"],
        schema="master",
    )
    create_index_if_missing(
        "ix_master_employee_is_recruiter",
        "master_employee",
        ["company_id", "is_recruiter"],
        schema="master",
    )
    create_index_if_missing(
        "ix_master_employee_is_hr",
        "master_employee",
        ["company_id", "is_hr"],
        schema="master",
    )
    op.execute(
        """
        UPDATE master.master_employee AS e
        SET is_hiring_manager = true
        WHERE e.is_deleted = false
          AND EXISTS (
            SELECT 1
            FROM master.master_employee AS r
            WHERE r.reporting_manager_id = e.id
              AND r.is_deleted = false
          )
        """
    )


def downgrade() -> None:
    op.drop_index("ix_master_employee_is_hr", table_name="master_employee", schema="master")
    op.drop_index("ix_master_employee_is_recruiter", table_name="master_employee", schema="master")
    op.drop_index("ix_master_employee_is_hiring_manager", table_name="master_employee", schema="master")
    op.drop_column("master_employee", "is_hr", schema="master")
    op.drop_column("master_employee", "is_recruiter", schema="master")
    op.drop_column("master_employee", "is_hiring_manager", schema="master")
