"""Create CrmCallLog table."""

from collections.abc import Sequence

from alembic import op

revision: str = "0150_crm_call_log"
down_revision: str | None = "0149_crm_meeting"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    try:
        from modules.crm.models.call_log import CrmCallLog  # noqa: F401
    except ModuleNotFoundError:
        return
    CrmCallLog.__table__.create(bind=op.get_bind(), checkfirst=True)


def downgrade() -> None:
    try:
        from modules.crm.models.call_log import CrmCallLog  # noqa: F401
    except ModuleNotFoundError:
        return
    CrmCallLog.__table__.drop(bind=op.get_bind(), checkfirst=True)
