"""Add editable Quote Information snapshot fields to crm_quote."""

import sys
from collections.abc import Sequence
from pathlib import Path

import sqlalchemy as sa

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))

from helpers import add_column_if_missing  # noqa: E402

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
        add_column_if_missing("crm_quote", column, schema="crm")


def downgrade() -> None:
    from alembic import op

    for column_name in ("owner_name", "service_type", "account_name", "project_title"):
        op.drop_column("crm_quote", column_name, schema="crm")
