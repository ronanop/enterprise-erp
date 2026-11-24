"""Create CrmOpportunity table."""

from collections.abc import Sequence

from alembic import op

revision: str = "0143_crm_opportunity"
down_revision: str | None = "0142_crm_lead_activity"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    try:
        from modules.crm.models.opportunity import CrmOpportunity  # noqa: F401,E402
    except ModuleNotFoundError:
        return
    F401,E402.__table__.create(bind=op.get_bind(), checkfirst=True)


def downgrade() -> None:
    try:
        from modules.crm.models.opportunity import CrmOpportunity  # noqa: F401,E402
    except ModuleNotFoundError:
        return
    F401,E402.__table__.drop(bind=op.get_bind(), checkfirst=True)
