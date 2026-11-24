"""Create PtDevice table."""

from collections.abc import Sequence

from alembic import op

revision: str = "0438_pt_device"
down_revision: str | None = "0437_pt_preference"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    try:
        from modules.portal.models.device import PtDevice  # noqa: F401
    except ModuleNotFoundError:
        return
    PtDevice.__table__.create(bind=op.get_bind(), checkfirst=True)


def downgrade() -> None:
    try:
        from modules.portal.models.device import PtDevice  # noqa: F401
    except ModuleNotFoundError:
        return
    PtDevice.__table__.drop(bind=op.get_bind(), checkfirst=True)
