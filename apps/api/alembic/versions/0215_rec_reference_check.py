"""Create RecReferenceCheck table."""

from collections.abc import Sequence

from alembic import op

revision: str = "0215_rec_reference_check"
down_revision: str | None = "0214_rec_background_verif"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    try:
        from modules.recruitment.models.reference_check import RecReferenceCheck  # noqa: F401
    except ModuleNotFoundError:
        return
    RecReferenceCheck.__table__.create(bind=op.get_bind(), checkfirst=True)


def downgrade() -> None:
    try:
        from modules.recruitment.models.reference_check import RecReferenceCheck  # noqa: F401
    except ModuleNotFoundError:
        return
    RecReferenceCheck.__table__.drop(bind=op.get_bind(), checkfirst=True)
