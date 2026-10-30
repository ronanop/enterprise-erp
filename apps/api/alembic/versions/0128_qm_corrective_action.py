"""Create QmCorrectiveAction table."""

from collections.abc import Sequence

from alembic import op

revision: str = "0128_qm_corrective_action"
down_revision: str | None = "0127_qm_root_cause"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    try:
        from modules.quality.models.capa import QmCorrectiveAction  # noqa: F401
    except ModuleNotFoundError:
        return
    QmCorrectiveAction.__table__.create(bind=op.get_bind(), checkfirst=True)


def downgrade() -> None:
    try:
        from modules.quality.models.capa import QmCorrectiveAction  # noqa: F401
    except ModuleNotFoundError:
        return
    QmCorrectiveAction.__table__.drop(bind=op.get_bind(), checkfirst=True)
