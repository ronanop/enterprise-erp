"""Create InvSerial table."""

from collections.abc import Sequence

from alembic import op

revision: str = "0081_inv_serial"
down_revision: str | None = "0080_inv_batch"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    try:
        from modules.inventory.models.serial import InvSerial  # noqa: F401
    except ModuleNotFoundError:
        return
    InvSerial.__table__.create(bind=op.get_bind(), checkfirst=True)


def downgrade() -> None:
    try:
        from modules.inventory.models.serial import InvSerial  # noqa: F401
    except ModuleNotFoundError:
        return
    InvSerial.__table__.drop(bind=op.get_bind(), checkfirst=True)
