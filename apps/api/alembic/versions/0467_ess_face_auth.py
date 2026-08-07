"""ESS face verification enrollment on HR employee profile."""

from __future__ import annotations

from collections.abc import Sequence

import sqlalchemy as sa
from alembic import op

revision: str = "0467_ess_face_auth"
down_revision: str | None = "0466_hr_leave_update_perm"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    op.add_column(
        "hr_employee_profile",
        sa.Column("face_auth_enabled", sa.Boolean(), nullable=False, server_default=sa.false()),
        schema="hr",
    )
    op.add_column(
        "hr_employee_profile",
        sa.Column("face_auth_fingerprint", sa.String(32), nullable=True),
        schema="hr",
    )


def downgrade() -> None:
    op.drop_column("hr_employee_profile", "face_auth_fingerprint", schema="hr")
    op.drop_column("hr_employee_profile", "face_auth_enabled", schema="hr")
