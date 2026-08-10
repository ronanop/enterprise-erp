"""Create PrjSiteInstallation table for site delivery workflow."""

import sys
from collections.abc import Sequence
from pathlib import Path

from alembic import op

sys.path.insert(0, str(Path(__file__).resolve().parents[2] / "src"))

from modules.project.models.site_installation import PrjSiteInstallation  # noqa: F401

revision: str = "0457_prj_site_installation"
down_revision: str | None = "0456_crm_oem_master"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    PrjSiteInstallation.__table__.create(bind=op.get_bind(), checkfirst=True)


def downgrade() -> None:
    PrjSiteInstallation.__table__.drop(bind=op.get_bind(), checkfirst=True)
