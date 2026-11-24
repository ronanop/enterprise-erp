"""Create GrcAudit table."""

from collections.abc import Sequence

from alembic import op

revision: str = "0346_grc_audit"
down_revision: str | None = "0345_grc_audit_plan"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    try:
        from modules.grc.models.audit import GrcAudit  # noqa: F401
    except ModuleNotFoundError:
        return
    GrcAudit.__table__.create(bind=op.get_bind(), checkfirst=True)


def downgrade() -> None:
    try:
        from modules.grc.models.audit import GrcAudit  # noqa: F401
    except ModuleNotFoundError:
        return
    GrcAudit.__table__.drop(bind=op.get_bind(), checkfirst=True)
