"""Create RecApplication table."""

from collections.abc import Sequence

from alembic import op

revision: str = "0208_rec_application"
down_revision: str | None = "0207_rec_cand_doc_resume"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    try:
        from modules.recruitment.models.application import RecApplication  # noqa: F401
    except ModuleNotFoundError:
        return
    RecApplication.__table__.create(bind=op.get_bind(), checkfirst=True)


def downgrade() -> None:
    try:
        from modules.recruitment.models.application import RecApplication  # noqa: F401
    except ModuleNotFoundError:
        return
    RecApplication.__table__.drop(bind=op.get_bind(), checkfirst=True)
