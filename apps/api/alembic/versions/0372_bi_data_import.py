"""Create BiDataImport table."""

from collections.abc import Sequence

from alembic import op

revision: str = "0372_bi_data_import"
down_revision: str | None = "0371_bi_data_export"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    try:
        from modules.analytics.models.data_import import BiDataImport  # noqa: F401
    except ModuleNotFoundError:
        return
    BiDataImport.__table__.create(bind=op.get_bind(), checkfirst=True)


def downgrade() -> None:
    try:
        from modules.analytics.models.data_import import BiDataImport  # noqa: F401
    except ModuleNotFoundError:
        return
    BiDataImport.__table__.drop(bind=op.get_bind(), checkfirst=True)
