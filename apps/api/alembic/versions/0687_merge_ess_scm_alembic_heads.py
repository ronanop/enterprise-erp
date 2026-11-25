"""Merge assets/SCM head with HRMS user-profile branch before ESS feed.

Revision ID: 0687_merge_ess_scm_alembic_heads
Revises: 0686_assets_it_non_it_submodules, 0681_hrms_user_profile
Create Date: 2026-11-25
"""

from collections.abc import Sequence

revision: str = "0687_merge_ess_scm_alembic_heads"
down_revision: str | Sequence[str] | None = (
    "0686_assets_it_non_it_submodules",
    "0681_hrms_user_profile",
)
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    # Schema already applied on each branch; merge only.
    pass


def downgrade() -> None:
    pass
