"""Merge asset_phase_2 and main CRM alembic heads.

Revision ID: 0617_merge_ast_crm_heads
Revises: 0614_ast_disposal_simplify, 0616_crm_product_type_widen
Create Date: 2026-09-23 08:59:49
"""

from typing import Sequence, Union

revision: str = "0617_merge_ast_crm_heads"
down_revision: Union[str, Sequence[str], None] = (
    "0614_ast_disposal_simplify",
    "0616_crm_product_type_widen",
)
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    pass


def downgrade() -> None:
    pass
