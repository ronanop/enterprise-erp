"""Add shared_to_scm_at on CRM OVF (when PO arrived in SCM queue)."""

import sys
from collections.abc import Sequence
from pathlib import Path

import sqlalchemy as sa
from alembic import op

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))

from helpers import add_column_if_missing  # noqa: E402

revision: str = "0461_crm_ovf_shared_to_scm_at"
down_revision: str | None = "0460_proc_order_grn_number"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    add_column_if_missing(
        "crm_ovf",
        sa.Column("shared_to_scm_at", sa.DateTime(timezone=True), nullable=True),
        schema="crm",
    )
    op.execute(
        """
        UPDATE crm.crm_ovf AS o
        SET shared_to_scm_at = h.performed_at
        FROM (
            SELECT DISTINCT ON (entity_id) entity_id, performed_at
            FROM crm.crm_state_history
            WHERE entity_type = 'ovf' AND action = 'share_to_scm'
            ORDER BY entity_id, performed_at ASC
        ) AS h
        WHERE o.id = h.entity_id
          AND o.shared_to_scm_at IS NULL
        """
    )
    op.execute(
        """
        UPDATE crm.crm_ovf
        SET shared_to_scm_at = updated_at
        WHERE shared_to_scm IS TRUE
          AND shared_to_scm_at IS NULL
          AND updated_at IS NOT NULL
        """
    )


def downgrade() -> None:
    op.drop_column("crm_ovf", "shared_to_scm_at", schema="crm")
