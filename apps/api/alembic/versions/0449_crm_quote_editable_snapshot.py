"""Add editable Quote Information snapshot fields to crm_quote."""

from collections.abc import Sequence

import sqlalchemy as sa
from alembic import op

revision: str = "0449_crm_quote_snapshot"
down_revision: str | None = "0448_crm_meeting_zoho"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    for column in (
        sa.Column("project_title", sa.String(length=255), nullable=True),
        sa.Column("account_name", sa.String(length=255), nullable=True),
        sa.Column("service_type", sa.String(length=50), nullable=True),
        sa.Column("owner_name", sa.String(length=255), nullable=True),
    ):
        op.add_column("crm_quote", column, schema="crm")


def downgrade() -> None:
    for column_name in ("owner_name", "service_type", "account_name", "project_title"):
        op.drop_column("crm_quote", column_name, schema="crm")
