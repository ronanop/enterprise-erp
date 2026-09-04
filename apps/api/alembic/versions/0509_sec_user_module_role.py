"""Add role on user module assignments (admin vs member)."""

from collections.abc import Sequence

import sqlalchemy as sa
from alembic import op

revision: str = "0509_sec_user_module_role"
down_revision: str | Sequence[str] | None = "0508_prj_customer_tracker"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    op.add_column(
        "sec_user_module",
        sa.Column("role", sa.String(length=20), nullable=False, server_default="member"),
        schema="foundation",
    )
    op.execute(
        sa.text("UPDATE foundation.sec_user_module SET role = 'admin' WHERE role = 'member'")
    )
    op.create_index(
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
