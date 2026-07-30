"""Add payroll_eligible on hr_employment for post-activation gate."""

from collections.abc import Sequence

import sqlalchemy as sa
from alembic import op

revision: str = "0456_hr_payroll_eligible"
down_revision: str | None = "0455_hr_att_enterprise"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    op.add_column(
        "hr_employment",
        sa.Column(
            "payroll_eligible",
            sa.Boolean(),
            nullable=False,
            server_default=sa.text("false"),
        ),
        schema="hr",
    )


def downgrade() -> None:
    op.drop_column("hr_employment", "payroll_eligible", schema="hr")
