"""Create HrSeparation table."""

from collections.abc import Sequence

from alembic import op

revision: str = "0176_hr_separation"
down_revision: str | None = "0175_hr_training_attendance"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    try:
        from modules.hr.models.separation import HrSeparation  # noqa: F401
    except ModuleNotFoundError:
        return
    HrSeparation.__table__.create(bind=op.get_bind(), checkfirst=True)


def downgrade() -> None:
    try:
        from modules.hr.models.separation import HrSeparation  # noqa: F401
    except ModuleNotFoundError:
        return
    HrSeparation.__table__.drop(bind=op.get_bind(), checkfirst=True)
