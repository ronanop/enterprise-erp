"""Create ast_incoming_asset_line / unit / arrival_event + permissions."""

from collections.abc import Sequence

from alembic import op

revision: str = "0561_ast_incoming_asset"
down_revision: str | None = "0560_ast_assignment_data_foundation"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    try:
        from modules.asset.models.incoming_asset import (  # noqa: E402, F401
    except ModuleNotFoundError:
        return
    (.__table__.create(bind=op.get_bind(), checkfirst=True)


def downgrade() -> None:
    try:
        from modules.asset.models.incoming_asset import (  # noqa: E402, F401
    except ModuleNotFoundError:
        return
    (.__table__.drop(bind=op.get_bind(), checkfirst=True)
