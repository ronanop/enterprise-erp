"""Add profile_photo_uri on hr_employee_profile for ESS/HRMS sync."""

from collections.abc import Sequence

import sqlalchemy as sa
from alembic import op

from helpers import add_column_if_missing

revision: str = "0673_hr_employee_profile_photo"
down_revision: str | Sequence[str] | None = "0672_mkt_chat_attachments"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    add_column_if_missing(
        "hr_employee_profile",
        sa.Column("profile_photo_uri", sa.String(length=500), nullable=True),
        schema="hr",
    )


def downgrade() -> None:
    op.drop_column("hr_employee_profile", "profile_photo_uri", schema="hr")
