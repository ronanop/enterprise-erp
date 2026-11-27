"""Merge PM site checkpoint branch with HR workplace head.

Revision ID: 0693_merge_prj_checkpoint_hr_heads
Revises: 0688_prj_site_checkpoint_yes_at, 0692_hr_workplace_task_transfer
Create Date: 2026-11-27
"""

from __future__ import annotations

from collections.abc import Sequence

revision: str = "0693_merge_prj_checkpoint_hr_heads"
down_revision: str | Sequence[str] | None = (
    "0688_prj_site_checkpoint_yes_at",
    "0692_hr_workplace_task_transfer",
)
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    pass


def downgrade() -> None:
    pass
