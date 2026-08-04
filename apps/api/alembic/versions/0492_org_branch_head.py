"""Add branch head employee reference on org_branch."""

from __future__ import annotations

from collections.abc import Sequence

import sqlalchemy as sa
from alembic import op
from sqlalchemy.dialects import postgresql

revision: str = "0492_org_branch_head"
down_revision: str | None = "0491_hr_mgmt_group_perms"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    op.add_column(
        "org_branch",
        sa.Column("head_employee_id", postgresql.UUID(as_uuid=True), nullable=True),
        schema="organization",
    )
    op.create_foreign_key(
        "fk_org_branch_head_employee",
        "org_branch",
        "master_employee",
        ["head_employee_id"],
        ["id"],
        source_schema="organization",
        referent_schema="master",
        ondelete="SET NULL",
    )


def downgrade() -> None:
    op.drop_constraint(
        "fk_org_branch_head_employee",
        "org_branch",
        schema="organization",
        type_="foreignkey",
    )
    op.drop_column("org_branch", "head_employee_id", schema="organization")
