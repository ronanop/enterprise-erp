"""Exit agreements signed on the system.

Creates ``hr.hr_exit_agreement`` so the NOC, confidentiality undertaking and
non-solicitation undertaking are issued, signed and evidenced inside the ERP
rather than on paper. The signed text is stored with a SHA-256 fingerprint so
the version the employee agreed to can be proved later.
"""

import sys
from collections.abc import Sequence
from pathlib import Path

from alembic import op

sys.path.insert(0, str(Path(__file__).resolve().parents[2] / "src"))

from modules.hr.models.exit_agreement import HrExitAgreement

revision: str = "0611_hr_exit_agreement"
down_revision: str | Sequence[str] | None = "0610_master_party_registration"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    HrExitAgreement.__table__.create(bind=op.get_bind(), checkfirst=True)


def downgrade() -> None:
    op.drop_table("hr_exit_agreement", schema="hr")
