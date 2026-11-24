"""Create fin_journal_line table."""

from collections.abc import Sequence

from alembic import op

revision: str = "0030_fin_journal_line"
down_revision: str | None = "0029_fin_journal_header"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    try:
        from modules.finance.models.journal import FinJournalLine  # noqa: F401
    except ModuleNotFoundError:
        return
    FinJournalLine.__table__.create(bind=op.get_bind(), checkfirst=True)


def downgrade() -> None:
    try:
        from modules.finance.models.journal import FinJournalLine  # noqa: F401
    except ModuleNotFoundError:
        return
    FinJournalLine.__table__.drop(bind=op.get_bind(), checkfirst=True)
