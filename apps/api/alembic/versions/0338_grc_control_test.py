"""Create GrcControlTest table."""

from collections.abc import Sequence

from alembic import op

revision: str = "0338_grc_control_test"
down_revision: str | None = "0337_grc_control"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    try:
        from modules.grc.models.control_test import GrcControlTest  # noqa: F401
    except ModuleNotFoundError:
        return
    GrcControlTest.__table__.create(bind=op.get_bind(), checkfirst=True)


def downgrade() -> None:
    try:
        from modules.grc.models.control_test import GrcControlTest  # noqa: F401
    except ModuleNotFoundError:
        return
    GrcControlTest.__table__.drop(bind=op.get_bind(), checkfirst=True)
