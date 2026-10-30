"""Create org_branch table."""

from collections.abc import Sequence

from alembic import op

revision: str = "0007_org_branch"
down_revision: str | None = "0006_org_company"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    try:
        from modules.organization.models.branch import OrgBranch  # noqa: F401
    except ModuleNotFoundError:
        return
    OrgBranch.__table__.create(bind=op.get_bind(), checkfirst=True)


def downgrade() -> None:
    try:
        from modules.organization.models.branch import OrgBranch  # noqa: F401
    except ModuleNotFoundError:
        return
    OrgBranch.__table__.drop(bind=op.get_bind(), checkfirst=True)
