"""Create sales_target table and seed Sales module permissions.

Already applied on this environment; retained so Alembic can resolve the
revision id while Service ITSM migrations follow as 0679/0680.
Full Sales module code remains in stash until restored.
"""

from __future__ import annotations

from collections.abc import Sequence

revision: str = "0678_sales_targets_and_permissions"
down_revision: str | Sequence[str] | None = "0677_prj_site_cloud_po_lines"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    # Applied previously; no-op for environments already stamped at this revision.
    pass


def downgrade() -> None:
    pass
