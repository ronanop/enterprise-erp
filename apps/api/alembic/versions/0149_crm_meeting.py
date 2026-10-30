"""Create CrmMeeting table."""

from collections.abc import Sequence

from alembic import op

revision: str = "0149_crm_meeting"
down_revision: str | None = "0148_crm_followup"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    try:
        from modules.crm.models.meeting import CrmMeeting  # noqa: F401,E402
    except ModuleNotFoundError:
        return
    F401,E402.__table__.create(bind=op.get_bind(), checkfirst=True)


def downgrade() -> None:
    try:
        from modules.crm.models.meeting import CrmMeeting  # noqa: F401,E402
    except ModuleNotFoundError:
        return
    F401,E402.__table__.drop(bind=op.get_bind(), checkfirst=True)
