"""Create QmFinalInspection table."""

from collections.abc import Sequence

from alembic import op

revision: str = "0123_qm_final_inspection"
down_revision: str | None = "0122_qm_inprocess_insp"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    try:
        from modules.quality.models.final_inspection import QmFinalInspection  # noqa: F401
    except ModuleNotFoundError:
        return
    QmFinalInspection.__table__.create(bind=op.get_bind(), checkfirst=True)


def downgrade() -> None:
    try:
        from modules.quality.models.final_inspection import QmFinalInspection  # noqa: F401
    except ModuleNotFoundError:
        return
    QmFinalInspection.__table__.drop(bind=op.get_bind(), checkfirst=True)
