"""Track last monthly leave accrual period per balance (idempotent Celery job)."""

from __future__ import annotations

from collections.abc import Sequence

import sqlalchemy as sa
from alembic import op

revision: str = "0468_hr_leave_accrual_period"
down_revision: str | None = "0467_ess_face_auth"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    op.add_column(
        "hr_leave_balance",
        sa.Column("last_accrual_yyyymm", sa.String(7), nullable=True),
        schema="hr",
    )


def downgrade() -> None:
    op.drop_column("hr_leave_balance", "last_accrual_yyyymm", schema="hr")
