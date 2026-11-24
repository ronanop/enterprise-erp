"""Create CrmLeadAssignment table."""

from collections.abc import Sequence

from alembic import op

revision: str = "0141_crm_lead_assignment"
down_revision: str | None = "0140_crm_lead"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    try:
        from modules.crm.models.lead_assignment import CrmLeadAssignment  # noqa: F401
    except ModuleNotFoundError:
        return
    CrmLeadAssignment.__table__.create(bind=op.get_bind(), checkfirst=True)


def downgrade() -> None:
    try:
        from modules.crm.models.lead_assignment import CrmLeadAssignment  # noqa: F401
    except ModuleNotFoundError:
        return
    CrmLeadAssignment.__table__.drop(bind=op.get_bind(), checkfirst=True)
