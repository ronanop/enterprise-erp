"""Store printable payload JSON on quote revision snapshots."""

from __future__ import annotations

import sys
from collections.abc import Sequence
from pathlib import Path

import sqlalchemy as sa
from alembic import op
from sqlalchemy.dialects import postgresql

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))

from helpers import column_exists, table_exists

revision: str = "0653_crm_quote_revision_payload"
down_revision: str | None = "0652_crm_quote_revision_snapshot"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    bind = op.get_bind()
    if not table_exists(bind, "crm_quote_revision_snapshot", schema="crm"):
        return
    if column_exists(bind, "crm_quote_revision_snapshot", "payload_json", schema="crm"):
        return
    op.add_column(
        "crm_quote_revision_snapshot",
        sa.Column("payload_json", postgresql.JSONB(astext_type=sa.Text()), nullable=True),
        schema="crm",
    )


def downgrade() -> None:
    bind = op.get_bind()
    if not table_exists(bind, "crm_quote_revision_snapshot", schema="crm"):
        return
    if not column_exists(bind, "crm_quote_revision_snapshot", "payload_json", schema="crm"):
        return
    op.drop_column("crm_quote_revision_snapshot", "payload_json", schema="crm")
