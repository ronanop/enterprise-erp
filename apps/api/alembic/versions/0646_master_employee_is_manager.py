"""Add is_manager (normal manager) people-role flag on master_employee."""

from collections.abc import Sequence

import sqlalchemy as sa
from alembic import op

from helpers import add_column_if_missing, create_index_if_missing

revision: str = "0646_master_employee_is_manager"
down_revision: str | None = "0645_org_company_payslip_identity"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    add_column_if_missing(
        "master_employee",
        sa.Column("is_manager", sa.Boolean(), nullable=False, server_default=sa.text("false")),
        schema="master",
    )
    create_index_if_missing(
        "ix_master_employee_is_manager",
        "master_employee",
        ["company_id", "is_manager"],
        schema="master",
    )
    # Anyone who already has direct reports is a normal manager.
    op.execute(
        """
        UPDATE master.master_employee AS e
        SET is_manager = true
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
    op.drop_index("ix_master_employee_is_manager", table_name="master_employee", schema="master")
    op.drop_column("master_employee", "is_manager", schema="master")
