"""Create RecJobRequisition table."""

from collections.abc import Sequence

from alembic import op

revision: str = "0202_rec_job_requisition"
down_revision: str | None = "0201_create_recruitment_schema"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    try:
        from modules.recruitment.models.job_requisition import RecJobRequisition  # noqa: F401
    except ModuleNotFoundError:
        return
    RecJobRequisition.__table__.create(bind=op.get_bind(), checkfirst=True)


def downgrade() -> None:
    try:
        from modules.recruitment.models.job_requisition import RecJobRequisition  # noqa: F401
    except ModuleNotFoundError:
        return
    RecJobRequisition.__table__.drop(bind=op.get_bind(), checkfirst=True)
