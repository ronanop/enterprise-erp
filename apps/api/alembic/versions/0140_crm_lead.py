"""Create CrmLead table.

crm_company must exist first because the current CrmLead model includes a
sales-process FK (company_account_id). Full sales-process tables/columns are
still finalized in 0445 (idempotent add_column / FK there).
"""

import sys
from collections.abc import Sequence
from pathlib import Path

from alembic import op

sys.path.insert(0, str(Path(__file__).resolve().parents[2] / "src"))

from modules.crm.models.company import CrmCompany  # noqa: F401,E402
from modules.crm.models.lead import CrmLead  # noqa: F401,E402

revision: str = "0140_crm_lead"
down_revision: str | None = "0139_crm_campaign"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    bind = op.get_bind()
    # Prerequisite for CrmLead.company_account_id FK (added with sales process).
    CrmCompany.__table__.create(bind=bind, checkfirst=True)
    CrmLead.__table__.create(bind=bind, checkfirst=True)


def downgrade() -> None:
    bind = op.get_bind()
    CrmLead.__table__.drop(bind=bind, checkfirst=True)
    # Leave crm_company for 0445 / later dependents; drop only if unused.
    CrmCompany.__table__.drop(bind=bind, checkfirst=True)
