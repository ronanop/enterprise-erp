"""Extend incoming asset tables for Sub-phase 2 QC + permissions."""

from collections.abc import Sequence

from alembic import op

revision: str = "0562_ast_incoming_qc"
down_revision: str | None = "0561_ast_incoming_asset"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    try:
        from modules.asset.models.incoming_asset import AstIncomingQcEvent  # noqa: E402, F401
    except ModuleNotFoundError:
        return
    AstIncomingQcEvent.__table__.create(bind=op.get_bind(), checkfirst=True)


def downgrade() -> None:
    try:
        from modules.asset.models.incoming_asset import AstIncomingQcEvent  # noqa: E402, F401
    except ModuleNotFoundError:
        return
    AstIncomingQcEvent.__table__.drop(bind=op.get_bind(), checkfirst=True)
