"""Delivery notification bookkeeping on the vendor PO.

Tracks what the customer and the distributor have already been told, so the
scheduled job can acknowledge a new order once, chase the distributor for an
ETD on a fixed cadence, and re-notify the customer only when the ETD changes.
"""

from collections.abc import Sequence

import sqlalchemy as sa
from alembic import op

revision: str = "0609_scm_delivery_notifications"
down_revision: str | Sequence[str] | None = "0608_scm_governance_transcript"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    for column in (
        "customer_ack_sent_at",
        "etd_reminder_last_sent_at",
        "etd_confirmed_at",
    ):
        op.add_column(
            "proc_order_header",
            sa.Column(column, sa.DateTime(timezone=True), nullable=True),
            schema="procurement",
        )
    op.add_column(
        "proc_order_header",
        sa.Column("etd_customer_notified_for", sa.Date(), nullable=True),
        schema="procurement",
    )


def downgrade() -> None:
    for column in (
        "etd_customer_notified_for",
        "etd_confirmed_at",
        "etd_reminder_last_sent_at",
        "customer_ack_sent_at",
    ):
        op.drop_column("proc_order_header", column, schema="procurement")
