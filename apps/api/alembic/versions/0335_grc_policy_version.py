"""Create GrcPolicyVersion table."""

from collections.abc import Sequence

from alembic import op

revision: str = "0335_grc_policy_version"
down_revision: str | None = "0334_grc_policy"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    try:
        from modules.grc.models.policy_version import GrcPolicyVersion  # noqa: F401
    except ModuleNotFoundError:
        return
    GrcPolicyVersion.__table__.create(bind=op.get_bind(), checkfirst=True)


def downgrade() -> None:
    try:
        from modules.grc.models.policy_version import GrcPolicyVersion  # noqa: F401
    except ModuleNotFoundError:
        return
    GrcPolicyVersion.__table__.drop(bind=op.get_bind(), checkfirst=True)
