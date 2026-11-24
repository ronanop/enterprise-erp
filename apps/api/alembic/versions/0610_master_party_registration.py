"""Customer and vendor registration forms with credit evaluation."""

from collections.abc import Sequence

from alembic import op

revision: str = "0610_master_party_registration"
down_revision: str | Sequence[str] | None = "0609_scm_delivery_notifications"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    try:
        from modules.master_data.models.party_registration import MasterPartyRegistration
    except ModuleNotFoundError:
        return
    MasterPartyRegistration.__table__.create(bind=op.get_bind(), checkfirst=True)


def downgrade() -> None:
    try:
        from modules.master_data.models.party_registration import MasterPartyRegistration
    except ModuleNotFoundError:
        return
    MasterPartyRegistration.__table__.drop(bind=op.get_bind(), checkfirst=True)
