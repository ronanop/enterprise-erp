"""Default sandwich ON: leave or absence on both flanks converts WO to LOP."""

from collections.abc import Sequence

import sqlalchemy as sa
from alembic import op

revision: str = "0591_pay_sandwich_both_default"
down_revision: str | None = "0590_hr_leave_adjust_event"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None

_TABLE = "pay_payroll_policy"
_SCHEMA = "payroll"


def upgrade() -> None:
    op.alter_column(
        _TABLE,
        "sandwich_enabled",
        schema=_SCHEMA,
        server_default=sa.text("true"),
        existing_type=sa.Boolean(),
        existing_nullable=False,
    )
    op.alter_column(
        _TABLE,
        "sandwich_triggers",
        schema=_SCHEMA,
        server_default="both",
        existing_type=sa.String(length=40),
        existing_nullable=False,
    )
    op.execute(
        sa.text(
            f"UPDATE {_SCHEMA}.{_TABLE} "
            "SET sandwich_enabled = true, sandwich_triggers = 'both' "
            "WHERE is_deleted IS NOT TRUE"
        )
    )


def downgrade() -> None:
    op.alter_column(
        _TABLE,
        "sandwich_enabled",
        schema=_SCHEMA,
        server_default=sa.text("false"),
        existing_type=sa.Boolean(),
        existing_nullable=False,
    )
    op.alter_column(
        _TABLE,
        "sandwich_triggers",
        schema=_SCHEMA,
        server_default="unauthorized_absence",
        existing_type=sa.String(length=40),
        existing_nullable=False,
    )
