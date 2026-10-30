"""Create fin_gl_entry table."""

from collections.abc import Sequence

from alembic import op

revision: str = "0031_fin_gl_entry"
down_revision: str | None = "0030_fin_journal_line"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    try:
        from modules.finance.models.ledger import FinGlEntry  # noqa: F401
    except ModuleNotFoundError:
        return
    FinGlEntry.__table__.create(bind=op.get_bind(), checkfirst=True)


def downgrade() -> None:
    try:
        from modules.finance.models.ledger import FinGlEntry  # noqa: F401
    except ModuleNotFoundError:
        return
    FinGlEntry.__table__.drop(bind=op.get_bind(), checkfirst=True)
