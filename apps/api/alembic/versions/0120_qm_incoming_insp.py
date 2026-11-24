"""Create QmIncomingInspection table."""

from collections.abc import Sequence

from alembic import op

revision: str = "0120_qm_incoming_insp"
down_revision: str | None = "0119_qm_quality_char"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    try:
        from modules.quality.models.incoming_inspection import QmIncomingInspection  # noqa: F401
    except ModuleNotFoundError:
        return
    QmIncomingInspection.__table__.create(bind=op.get_bind(), checkfirst=True)


def downgrade() -> None:
    try:
        from modules.quality.models.incoming_inspection import QmIncomingInspection  # noqa: F401
    except ModuleNotFoundError:
        return
    QmIncomingInspection.__table__.drop(bind=op.get_bind(), checkfirst=True)
