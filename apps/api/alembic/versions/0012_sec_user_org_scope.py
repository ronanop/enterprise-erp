"""Create sec_user_org_scope table."""

from collections.abc import Sequence

from alembic import op

revision: str = "0012_sec_user_org_scope"
down_revision: str | None = "0011_seed_org_permissions"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    try:
        from modules.foundation.models.security import SecUserOrgScope  # noqa: F401
    except ModuleNotFoundError:
        return
    SecUserOrgScope.__table__.create(bind=op.get_bind(), checkfirst=True)


def downgrade() -> None:
    try:
        from modules.foundation.models.security import SecUserOrgScope  # noqa: F401
    except ModuleNotFoundError:
        return
    SecUserOrgScope.__table__.drop(bind=op.get_bind(), checkfirst=True)
