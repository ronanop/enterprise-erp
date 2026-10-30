"""Create CrmLeadActivity table."""

from collections.abc import Sequence

from alembic import op

revision: str = "0142_crm_lead_activity"
down_revision: str | None = "0141_crm_lead_assignment"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    try:
        from modules.crm.models.lead_activity import CrmLeadActivity  # noqa: F401
    except ModuleNotFoundError:
        return
    CrmLeadActivity.__table__.create(bind=op.get_bind(), checkfirst=True)


def downgrade() -> None:
    try:
        from modules.crm.models.lead_activity import CrmLeadActivity  # noqa: F401
    except ModuleNotFoundError:
        return
    CrmLeadActivity.__table__.drop(bind=op.get_bind(), checkfirst=True)
