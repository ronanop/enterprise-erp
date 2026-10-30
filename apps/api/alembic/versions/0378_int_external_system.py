"""Create IntExternalSystem table."""

from collections.abc import Sequence

from alembic import op

revision: str = "0378_int_external_system"
down_revision: str | None = "0377_create_integration_schema"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    try:
        from modules.integration.models.external_system import IntExternalSystem  # noqa: F401
    except ModuleNotFoundError:
        return
    IntExternalSystem.__table__.create(bind=op.get_bind(), checkfirst=True)


def downgrade() -> None:
    try:
        from modules.integration.models.external_system import IntExternalSystem  # noqa: F401
    except ModuleNotFoundError:
        return
    IntExternalSystem.__table__.drop(bind=op.get_bind(), checkfirst=True)
