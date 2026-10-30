"""Recreate prj_site_installation to match site delivery ORM model."""

from collections.abc import Sequence

from alembic import op

revision: str = "0458_prj_site_installation_align"
down_revision: str | None = "0457_prj_site_installation"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    try:
        from modules.project.models.site_installation import PrjSiteInstallation  # noqa: F401
    except ModuleNotFoundError:
        return
    PrjSiteInstallation.__table__.create(bind=op.get_bind(), checkfirst=True)


def downgrade() -> None:
    try:
        from modules.project.models.site_installation import PrjSiteInstallation  # noqa: F401
    except ModuleNotFoundError:
        return
    PrjSiteInstallation.__table__.drop(bind=op.get_bind(), checkfirst=True)
