"""Create QmQualityCharacteristic table."""

from collections.abc import Sequence

from alembic import op

revision: str = "0119_qm_quality_char"
down_revision: str | None = "0118_qm_inspection_plan"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    try:
        from modules.quality.models.characteristic import QmQualityCharacteristic  # noqa: F401
    except ModuleNotFoundError:
        return
    QmQualityCharacteristic.__table__.create(bind=op.get_bind(), checkfirst=True)


def downgrade() -> None:
    try:
        from modules.quality.models.characteristic import QmQualityCharacteristic  # noqa: F401
    except ModuleNotFoundError:
        return
    QmQualityCharacteristic.__table__.drop(bind=op.get_bind(), checkfirst=True)
