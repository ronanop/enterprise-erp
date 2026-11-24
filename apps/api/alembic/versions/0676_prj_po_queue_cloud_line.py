"""Add cloud_name and line_type to Projects PO queue handoff for sheet-tracker sync."""

from __future__ import annotations

from collections.abc import Sequence

import sqlalchemy as sa
from alembic import op

revision: str = "0676_prj_po_queue_cloud_line"
down_revision: str | Sequence[str] | None = "0675_crm_margin_pct_10dp"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    op.add_column(
        "prj_po_queue_handoff",
        sa.Column("cloud_name", sa.String(length=255), nullable=True),
        schema="project",
    )
    op.add_column(
        "prj_po_queue_handoff",
        sa.Column("line_type", sa.String(length=255), nullable=True),
        schema="project",
    )
    op.create_index(
        "ix_prj_po_queue_handoff_cloud_name",
        "prj_po_queue_handoff",
        ["cloud_name"],
        schema="project",
    )


def downgrade() -> None:
    op.drop_index(
        "ix_prj_po_queue_handoff_cloud_name",
        table_name="prj_po_queue_handoff",
        schema="project",
    )
    op.drop_column("prj_po_queue_handoff", "line_type", schema="project")
    op.drop_column("prj_po_queue_handoff", "cloud_name", schema="project")
