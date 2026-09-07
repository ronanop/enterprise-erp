"""Create hr.hr_admin_nav_access for per-HR-Admin sidebar menus."""

import sys
from collections.abc import Sequence
from pathlib import Path

from alembic import op

sys.path.insert(0, str(Path(__file__).resolve().parents[2] / "src"))

from modules.hr.models.hr_admin_nav_access import HrAdminNavAccess  # noqa: F401

revision: str = "0592_hr_admin_nav_access"
down_revision: str | None = "0591_pay_sandwich_both_default"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    HrAdminNavAccess.__table__.create(bind=op.get_bind(), checkfirst=True)


def downgrade() -> None:
    HrAdminNavAccess.__table__.drop(bind=op.get_bind(), checkfirst=True)
