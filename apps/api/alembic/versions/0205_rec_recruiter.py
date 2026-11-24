"""Create RecRecruiter table."""

from collections.abc import Sequence

from alembic import op

revision: str = "0205_rec_recruiter"
down_revision: str | None = "0204_rec_recruitment_source"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    try:
        from modules.recruitment.models.recruiter import RecRecruiter  # noqa: F401
    except ModuleNotFoundError:
        return
    RecRecruiter.__table__.create(bind=op.get_bind(), checkfirst=True)


def downgrade() -> None:
    try:
        from modules.recruitment.models.recruiter import RecRecruiter  # noqa: F401
    except ModuleNotFoundError:
        return
    RecRecruiter.__table__.drop(bind=op.get_bind(), checkfirst=True)
