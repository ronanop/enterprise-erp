"""Create CrmFollowup table."""

from collections.abc import Sequence

from alembic import op

revision: str = "0148_crm_followup"
down_revision: str | None = "0147_crm_task"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    try:
        from modules.crm.models.followup import CrmFollowup  # noqa: F401
    except ModuleNotFoundError:
        return
    CrmFollowup.__table__.create(bind=op.get_bind(), checkfirst=True)


def downgrade() -> None:
    try:
        from modules.crm.models.followup import CrmFollowup  # noqa: F401
    except ModuleNotFoundError:
        return
    CrmFollowup.__table__.drop(bind=op.get_bind(), checkfirst=True)
