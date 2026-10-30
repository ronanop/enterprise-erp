"""Create QmInprocessInspection table."""

from collections.abc import Sequence

from alembic import op

revision: str = "0122_qm_inprocess_insp"
down_revision: str | None = "0121_qm_incoming_insp_line"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    try:
        from modules.quality.models.inprocess_inspection import QmInprocessInspection  # noqa: F401
    except ModuleNotFoundError:
        return
    QmInprocessInspection.__table__.create(bind=op.get_bind(), checkfirst=True)


def downgrade() -> None:
    try:
        from modules.quality.models.inprocess_inspection import QmInprocessInspection  # noqa: F401
    except ModuleNotFoundError:
        return
    QmInprocessInspection.__table__.drop(bind=op.get_bind(), checkfirst=True)
