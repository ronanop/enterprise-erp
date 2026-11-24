"""Snapshot cloud PO lines on site installation for project detail table."""

from __future__ import annotations

from collections.abc import Sequence

import sqlalchemy as sa
from alembic import op
from sqlalchemy.dialects import postgresql

revision: str = "0677_prj_site_cloud_po_lines"
down_revision: str | Sequence[str] | None = "0676_prj_po_queue_cloud_line"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    op.add_column(
        "prj_site_installation",
        sa.Column(
            "cloud_po_lines",
            postgresql.JSONB(astext_type=sa.Text()),
            server_default=sa.text("'[]'::jsonb"),
            nullable=False,
        ),
        schema="project",
    )


def downgrade() -> None:
    op.drop_column("prj_site_installation", "cloud_po_lines", schema="project")
