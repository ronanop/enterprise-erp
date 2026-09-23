"""Add disposal governance + management_approved columns; clear legacy Retired/Pending ops.

Idempotent ADD COLUMN IF NOT EXISTS for environments with diverged alembic history.
"""

from collections.abc import Sequence

import sqlalchemy as sa
from alembic import op

revision: str = "0614_ast_disposal_simplify"
down_revision: tuple[str, str] | None = (
    "0613_audit_operation_widen",
    "0512_ast_component_asset_id_repair",
)
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    op.execute(
        sa.text(
            """
            ALTER TABLE asset.ast_asset_disposal
              ADD COLUMN IF NOT EXISTS remarks TEXT,
              ADD COLUMN IF NOT EXISTS management_approved BOOLEAN,
              ADD COLUMN IF NOT EXISTS ceo_instruction TEXT,
              ADD COLUMN IF NOT EXISTS rejection_reason TEXT,
              ADD COLUMN IF NOT EXISTS previous_operational_status VARCHAR(40),
              ADD COLUMN IF NOT EXISTS approved_at TIMESTAMPTZ,
              ADD COLUMN IF NOT EXISTS approved_by UUID,
              ADD COLUMN IF NOT EXISTS completed_at TIMESTAMPTZ,
              ADD COLUMN IF NOT EXISTS completed_by UUID
            """
        )
    )
    op.execute(
        sa.text(
            """
            UPDATE asset.ast_asset
            SET operational_status = 'READY_TO_MOVE',
                updated_at = NOW()
            WHERE is_deleted IS FALSE
              AND operational_status IN ('RETIRED', 'PENDING_DISPOSAL')
              AND LOWER(COALESCE(status, '')) NOT IN ('disposed', 'written_off', 'cancelled')
            """
        )
    )


def downgrade() -> None:
    op.execute(
        sa.text(
            "ALTER TABLE asset.ast_asset_disposal DROP COLUMN IF EXISTS management_approved"
        )
    )
