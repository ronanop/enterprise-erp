"""Create CrmInteraction table."""

from collections.abc import Sequence

from alembic import op

revision: str = "0146_crm_interaction"
down_revision: str | None = "0145_crm_campaign_member"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    try:
        from modules.crm.models.interaction import CrmInteraction  # noqa: F401
    except ModuleNotFoundError:
        return
    CrmInteraction.__table__.create(bind=op.get_bind(), checkfirst=True)


def downgrade() -> None:
    try:
        from modules.crm.models.interaction import CrmInteraction  # noqa: F401
    except ModuleNotFoundError:
        return
    CrmInteraction.__table__.drop(bind=op.get_bind(), checkfirst=True)
