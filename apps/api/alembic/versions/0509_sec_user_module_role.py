"""Add role on user module assignments (admin vs member)."""

import sys
from collections.abc import Sequence
from pathlib import Path

import sqlalchemy as sa
from alembic import op

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))

from helpers import add_column_if_missing, create_index_if_missing  # noqa: E402

revision: str = "0509_sec_user_module_role"
down_revision: str | Sequence[str] | None = "0508_prj_customer_tracker"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    add_column_if_missing(
        "sec_user_module",
        sa.Column("role", sa.String(length=20), nullable=False, server_default="member"),
        schema="foundation",
    )
    op.execute(
        sa.text("UPDATE foundation.sec_user_module SET role = 'admin' WHERE role = 'member'")
    )
    create_index_if_missing(
        "ix_foundation_sec_user_module_module_key",
        "sec_user_module",
        ["module_key"],
        schema="foundation",
    )


def downgrade() -> None:
    op.drop_index(
        "ix_foundation_sec_user_module_module_key",
        table_name="sec_user_module",
        schema="foundation",
    )
    op.drop_column("sec_user_module", "role", schema="foundation")
