"""Create CrmTask table."""

import sys
from collections.abc import Sequence
from pathlib import Path

from alembic import op

sys.path.insert(0, str(Path(__file__).resolve().parents[2] / "src"))

from modules.crm.models.task import CrmTask  # noqa: F401,E402

revision: str = "0147_crm_task"
down_revision: str | None = "0146_crm_interaction"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    CrmTask.__table__.create(bind=op.get_bind(), checkfirst=True)


def downgrade() -> None:
    CrmTask.__table__.drop(bind=op.get_bind(), checkfirst=True)
