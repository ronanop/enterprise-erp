"""Create MfgWorkCenter table."""

from collections.abc import Sequence

from alembic import op

revision: str = "0096_mfg_work_center"
down_revision: str | None = "0095_create_mfg_schema"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    try:
        from modules.manufacturing.models.work_center import MfgWorkCenter  # noqa: F401
    except ModuleNotFoundError:
        return
    MfgWorkCenter.__table__.create(bind=op.get_bind(), checkfirst=True)


def downgrade() -> None:
    try:
        from modules.manufacturing.models.work_center import MfgWorkCenter  # noqa: F401
    except ModuleNotFoundError:
        return
    MfgWorkCenter.__table__.drop(bind=op.get_bind(), checkfirst=True)
