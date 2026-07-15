"""Create GrcAuditFinding table."""

import sys
from collections.abc import Sequence
from pathlib import Path

from alembic import op

sys.path.insert(0, str(Path(__file__).resolve().parents[2] / "src"))

from modules.grc.models.audit_finding import GrcAuditFinding  # noqa: F401

revision: str = "0347_grc_audit_finding"
down_revision: str | None = "0346_grc_audit"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    GrcAuditFinding.__table__.create(bind=op.get_bind(), checkfirst=True)


def downgrade() -> None:
    GrcAuditFinding.__table__.drop(bind=op.get_bind(), checkfirst=True)
