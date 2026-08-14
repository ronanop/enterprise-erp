"""Add read_at and inbox index on foundation.ntf_event."""

from collections.abc import Sequence

import sqlalchemy as sa
from alembic import op

revision: str = "0473_ntf_event_read_at"
down_revision: str | None = "0472_pay_run_line_period_days"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    op.add_column(
        "ntf_event",
        sa.Column("read_at", sa.DateTime(timezone=True), nullable=True),
        schema="foundation",
    )
    op.create_index(
        "ix_ntf_event_inbox",
        "ntf_event",
        ["tenant_id", "recipient_user_id", "created_at"],
        schema="foundation",
    )


def downgrade() -> None:
    op.drop_index("ix_ntf_event_inbox", table_name="ntf_event", schema="foundation")
    op.drop_column("ntf_event", "read_at", schema="foundation")
