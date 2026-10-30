"""Create QmQualityScore table."""

from collections.abc import Sequence

from alembic import op

revision: str = "0133_qm_quality_score"
down_revision: str | None = "0132_qm_quality_audit"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    try:
        from modules.quality.models.quality_score import QmQualityScore  # noqa: F401
    except ModuleNotFoundError:
        return
    QmQualityScore.__table__.create(bind=op.get_bind(), checkfirst=True)


def downgrade() -> None:
    try:
        from modules.quality.models.quality_score import QmQualityScore  # noqa: F401
    except ModuleNotFoundError:
        return
    QmQualityScore.__table__.drop(bind=op.get_bind(), checkfirst=True)
