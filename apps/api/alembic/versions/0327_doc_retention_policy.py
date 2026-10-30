"""Create DocRetentionPolicy table."""

from collections.abc import Sequence

from alembic import op

revision: str = "0327_doc_retention_policy"
down_revision: str | None = "0326_doc_template_field"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    try:
        from modules.document.models.retention_policy import DocRetentionPolicy  # noqa: F401
    except ModuleNotFoundError:
        return
    DocRetentionPolicy.__table__.create(bind=op.get_bind(), checkfirst=True)


def downgrade() -> None:
    try:
        from modules.document.models.retention_policy import DocRetentionPolicy  # noqa: F401
    except ModuleNotFoundError:
        return
    DocRetentionPolicy.__table__.drop(bind=op.get_bind(), checkfirst=True)
