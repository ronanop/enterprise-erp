"""Create GrcCorrectiveAction table."""

from collections.abc import Sequence

from alembic import op

revision: str = "0348_grc_corrective_action"
down_revision: str | None = "0347_grc_audit_finding"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    try:
        from modules.grc.models.corrective_action import GrcCorrectiveAction  # noqa: F401
    except ModuleNotFoundError:
        return
    GrcCorrectiveAction.__table__.create(bind=op.get_bind(), checkfirst=True)


def downgrade() -> None:
    try:
        from modules.grc.models.corrective_action import GrcCorrectiveAction  # noqa: F401
    except ModuleNotFoundError:
        return
    GrcCorrectiveAction.__table__.drop(bind=op.get_bind(), checkfirst=True)
