"""Add checkpoint_yes_at JSONB for Yes-clicked timestamps.

Revision ID: 0688_prj_site_checkpoint_yes_at
Revises: 0687_prj_site_install_split_checkboxes
Create Date: 2026-11-27
"""

from __future__ import annotations

from collections.abc import Sequence

import sqlalchemy as sa
from alembic import op
from sqlalchemy.dialects import postgresql

revision: str = "0688_prj_site_checkpoint_yes_at"
down_revision: str | Sequence[str] | None = "0687_prj_site_install_split_checkboxes"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    op.add_column(
        "prj_site_installation",
        sa.Column(
            "checkpoint_yes_at",
            postgresql.JSONB(astext_type=sa.Text()),
            nullable=False,
            server_default=sa.text("'{}'::jsonb"),
        ),
        schema="project",
    )


def downgrade() -> None:
    op.drop_column("prj_site_installation", "checkpoint_yes_at", schema="project")
