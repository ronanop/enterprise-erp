"""Create MfgRoutingOperation table."""

from collections.abc import Sequence

from alembic import op

revision: str = "0101_mfg_routing_operation"
down_revision: str | None = "0100_mfg_routing"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    try:
        from modules.manufacturing.models.routing import MfgRoutingOperation  # noqa: F401
    except ModuleNotFoundError:
        return
    MfgRoutingOperation.__table__.create(bind=op.get_bind(), checkfirst=True)


def downgrade() -> None:
    try:
        from modules.manufacturing.models.routing import MfgRoutingOperation  # noqa: F401
    except ModuleNotFoundError:
        return
    MfgRoutingOperation.__table__.drop(bind=op.get_bind(), checkfirst=True)
