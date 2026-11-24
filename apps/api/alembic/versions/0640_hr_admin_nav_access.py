"""Create hr.hr_admin_nav_access for per-HR-Admin sidebar menus."""

from collections.abc import Sequence

from alembic import op

revision: str = "0640_hr_admin_nav_access"
down_revision: str | None = "0639_pay_sandwich_both_default"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    try:
        from modules.hr.models.hr_admin_nav_access import HrAdminNavAccess  # noqa: F401
    except ModuleNotFoundError:
        return
    HrAdminNavAccess.__table__.create(bind=op.get_bind(), checkfirst=True)


def downgrade() -> None:
    try:
        from modules.hr.models.hr_admin_nav_access import HrAdminNavAccess  # noqa: F401
    except ModuleNotFoundError:
        return
    HrAdminNavAccess.__table__.drop(bind=op.get_bind(), checkfirst=True)
