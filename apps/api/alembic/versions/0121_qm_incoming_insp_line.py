"""Create QmIncomingInspectionLine table."""

from collections.abc import Sequence

from alembic import op

revision: str = "0121_qm_incoming_insp_line"
down_revision: str | None = "0120_qm_incoming_insp"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    try:
        from modules.quality.models.incoming_inspection import QmIncomingInspectionLine  # noqa: F401
    except ModuleNotFoundError:
        return
    QmIncomingInspectionLine.__table__.create(bind=op.get_bind(), checkfirst=True)


def downgrade() -> None:
    try:
        from modules.quality.models.incoming_inspection import QmIncomingInspectionLine  # noqa: F401
    except ModuleNotFoundError:
        return
    QmIncomingInspectionLine.__table__.drop(bind=op.get_bind(), checkfirst=True)
