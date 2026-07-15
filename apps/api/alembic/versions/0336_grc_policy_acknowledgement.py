"""Create GrcPolicyAcknowledgement table."""

import sys
from collections.abc import Sequence
from pathlib import Path

from alembic import op

sys.path.insert(0, str(Path(__file__).resolve().parents[2] / "src"))

from modules.grc.models.policy_acknowledgement import GrcPolicyAcknowledgement  # noqa: F401

revision: str = "0336_grc_policy_acknowledgement"
down_revision: str | None = "0335_grc_policy_version"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    GrcPolicyAcknowledgement.__table__.create(bind=op.get_bind(), checkfirst=True)


def downgrade() -> None:
    GrcPolicyAcknowledgement.__table__.drop(bind=op.get_bind(), checkfirst=True)
