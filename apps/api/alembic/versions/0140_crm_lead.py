"""Create CrmLead table."""

import sys
from collections.abc import Sequence
from pathlib import Path

from alembic import op

sys.path.insert(0, str(Path(__file__).resolve().parents[2] / "src"))
sys.path.insert(0, str(Path(__file__).resolve().parents[1]))

from helpers import create_orm_table  # noqa: E402
from modules.crm.models.company import CrmCompany  # noqa: F401,E402
from modules.crm.models.lead import CrmLead  # noqa: F401,E402

revision: str = "0140_crm_lead"
down_revision: str | None = "0139_crm_campaign"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    bind = op.get_bind()
    # CrmLead.company_account_id FK targets crm_company (added as a sales-process
    # table in 0445). Create it first so model-driven CREATE TABLE succeeds.
    create_orm_table(CrmCompany.__table__, bind)
    create_orm_table(CrmLead.__table__, bind)


def downgrade() -> None:
    bind = op.get_bind()
    CrmLead.__table__.drop(bind=bind, checkfirst=True)
    CrmCompany.__table__.drop(bind=bind, checkfirst=True)
