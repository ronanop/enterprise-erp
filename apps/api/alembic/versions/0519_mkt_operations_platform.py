"""Marketing operations tables, campaign expansions, and ops permissions."""

from collections.abc import Sequence

from alembic import op

revision: str = "0519_mkt_operations_platform"
down_revision: str | Sequence[str] | None = "0518_grant_marketing_admin_perms"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    try:
        from modules.marketing.models.approval import MktApproval
    except ModuleNotFoundError:
        return
    MktApproval.__table__.create(bind=op.get_bind(), checkfirst=True)


def downgrade() -> None:
    try:
        from modules.marketing.models.approval import MktApproval
    except ModuleNotFoundError:
        return
    MktApproval.__table__.drop(bind=op.get_bind(), checkfirst=True)
