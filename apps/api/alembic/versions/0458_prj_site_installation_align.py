"""Recreate prj_site_installation to match site delivery ORM model.

The original 0457 create used checkfirst=True against an earlier divergent
schema (install_scope/current_stage/circle_id/...). Drop and recreate so
columns match PrjSiteInstallation.
"""

import sys
from collections.abc import Sequence
from pathlib import Path

from alembic import op
import sqlalchemy as sa

sys.path.insert(0, str(Path(__file__).resolve().parents[2] / "src"))

from modules.project.models.site_installation import PrjSiteInstallation  # noqa: F401

revision: str = "0458_prj_site_installation_align"
down_revision: str | None = "0457_prj_site_installation"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    op.execute(sa.text("DROP TABLE IF EXISTS project.prj_site_installation CASCADE"))
    PrjSiteInstallation.__table__.create(bind=op.get_bind(), checkfirst=False)


def downgrade() -> None:
    op.execute(sa.text("DROP TABLE IF EXISTS project.prj_site_installation CASCADE"))
