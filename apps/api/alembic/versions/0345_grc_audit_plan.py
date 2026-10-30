"""Create GrcAuditPlan table."""

from collections.abc import Sequence

from alembic import op

revision: str = "0345_grc_audit_plan"
down_revision: str | None = "0344_grc_compliance_assessment"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    try:
        from modules.grc.models.audit_plan import GrcAuditPlan  # noqa: F401
    except ModuleNotFoundError:
        return
    GrcAuditPlan.__table__.create(bind=op.get_bind(), checkfirst=True)


def downgrade() -> None:
    try:
        from modules.grc.models.audit_plan import GrcAuditPlan  # noqa: F401
    except ModuleNotFoundError:
        return
    GrcAuditPlan.__table__.drop(bind=op.get_bind(), checkfirst=True)
