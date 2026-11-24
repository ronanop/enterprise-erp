"""Create RecCandidateNote table."""

from collections.abc import Sequence

from alembic import op

revision: str = "0217_rec_candidate_note"
down_revision: str | None = "0216_rec_talent_pool"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    try:
        from modules.recruitment.models.candidate_note import RecCandidateNote  # noqa: F401
    except ModuleNotFoundError:
        return
    RecCandidateNote.__table__.create(bind=op.get_bind(), checkfirst=True)


def downgrade() -> None:
    try:
        from modules.recruitment.models.candidate_note import RecCandidateNote  # noqa: F401
    except ModuleNotFoundError:
        return
    RecCandidateNote.__table__.drop(bind=op.get_bind(), checkfirst=True)
