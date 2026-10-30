"""Exit agreements signed on the system."""

from collections.abc import Sequence

from alembic import op

revision: str = "0611_hr_exit_agreement"
down_revision: str | Sequence[str] | None = "0610_master_party_registration"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    try:
        from modules.hr.models.exit_agreement import HrExitAgreement
    except ModuleNotFoundError:
        return
    HrExitAgreement.__table__.create(bind=op.get_bind(), checkfirst=True)


def downgrade() -> None:
    try:
        from modules.hr.models.exit_agreement import HrExitAgreement
    except ModuleNotFoundError:
        return
    HrExitAgreement.__table__.drop(bind=op.get_bind(), checkfirst=True)
