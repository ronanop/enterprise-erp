"""Create GrcAuditFinding table."""

from collections.abc import Sequence

from alembic import op

revision: str = "0347_grc_audit_finding"
down_revision: str | None = "0346_grc_audit"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    try:
        from modules.grc.models.audit_finding import GrcAuditFinding  # noqa: F401
    except ModuleNotFoundError:
        return
    GrcAuditFinding.__table__.create(bind=op.get_bind(), checkfirst=True)


def downgrade() -> None:
    try:
        from modules.grc.models.audit_finding import GrcAuditFinding  # noqa: F401
    except ModuleNotFoundError:
        return
    GrcAuditFinding.__table__.drop(bind=op.get_bind(), checkfirst=True)
