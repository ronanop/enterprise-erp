"""Create QmCapa table."""

from collections.abc import Sequence

from alembic import op

revision: str = "0126_qm_capa"
down_revision: str | None = "0125_qm_ncr"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    try:
        from modules.quality.models.capa import QmCapa  # noqa: F401
    except ModuleNotFoundError:
        return
    QmCapa.__table__.create(bind=op.get_bind(), checkfirst=True)


def downgrade() -> None:
    try:
        from modules.quality.models.capa import QmCapa  # noqa: F401
    except ModuleNotFoundError:
        return
    QmCapa.__table__.drop(bind=op.get_bind(), checkfirst=True)
