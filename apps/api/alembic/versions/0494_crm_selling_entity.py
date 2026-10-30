"""CRM selling / billing entity master and seed Cache group entities."""

from collections.abc import Sequence

from alembic import op

revision: str = "0494_crm_selling_entity"
down_revision: str | None = "0493_crm_lead_designation"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    try:
        from modules.crm.models.selling_entity import CrmSellingEntity  # noqa: E402,F401
    except ModuleNotFoundError:
        return
    E402,F401.__table__.create(bind=op.get_bind(), checkfirst=True)


def downgrade() -> None:
    try:
        from modules.crm.models.selling_entity import CrmSellingEntity  # noqa: E402,F401
    except ModuleNotFoundError:
        return
    E402,F401.__table__.drop(bind=op.get_bind(), checkfirst=True)
