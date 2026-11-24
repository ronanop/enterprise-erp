"""Add asset_domain + ast_domain_membership + asset.module:admin permission."""

from collections.abc import Sequence

from alembic import op

revision: str = "0500_ast_asset_domain"
down_revision: str | None = "0499_ast_assignment_manual_employee"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    try:
        from modules.asset.models.domain_membership import AstDomainMembership  # noqa: E402, F401
    except ModuleNotFoundError:
        return
    AstDomainMembership.__table__.create(bind=op.get_bind(), checkfirst=True)


def downgrade() -> None:
    try:
        from modules.asset.models.domain_membership import AstDomainMembership  # noqa: E402, F401
    except ModuleNotFoundError:
        return
    AstDomainMembership.__table__.drop(bind=op.get_bind(), checkfirst=True)
