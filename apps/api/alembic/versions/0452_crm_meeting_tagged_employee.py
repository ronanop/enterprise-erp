"""Add optional tagged internal member on CRM meetings."""

from collections.abc import Sequence

import sqlalchemy as sa
from alembic import op

revision: str = "0452_crm_meeting_tagged"
down_revision: str | None = "0451_crm_task_assignment"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    op.add_column(
        "crm_meeting",
        sa.Column("tagged_employee_id", sa.UUID(), nullable=True),
        schema="crm",
    )
    op.create_foreign_key(
        "fk_crm_meeting_tagged_employee",
        "crm_meeting",
        "master_employee",
        ["tagged_employee_id"],
        ["id"],
        source_schema="crm",
        referent_schema="master",
        ondelete="RESTRICT",
    )
    op.create_index(
        "ix_crm_meeting_tagged_employee_id",
        "crm_meeting",
        ["tagged_employee_id"],
        unique=False,
        schema="crm",
    )


def downgrade() -> None:
    op.drop_index("ix_crm_meeting_tagged_employee_id", table_name="crm_meeting", schema="crm")
    op.drop_constraint("fk_crm_meeting_tagged_employee", "crm_meeting", schema="crm", type_="foreignkey")
    op.drop_column("crm_meeting", "tagged_employee_id", schema="crm")
