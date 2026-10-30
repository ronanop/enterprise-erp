"""Create MfgMachine table."""

from collections.abc import Sequence

from alembic import op

revision: str = "0097_mfg_machine"
down_revision: str | None = "0096_mfg_work_center"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    try:
        from modules.manufacturing.models.machine import MfgMachine  # noqa: F401
    except ModuleNotFoundError:
        return
    MfgMachine.__table__.create(bind=op.get_bind(), checkfirst=True)


def downgrade() -> None:
    try:
        from modules.manufacturing.models.machine import MfgMachine  # noqa: F401
    except ModuleNotFoundError:
        return
    MfgMachine.__table__.drop(bind=op.get_bind(), checkfirst=True)
