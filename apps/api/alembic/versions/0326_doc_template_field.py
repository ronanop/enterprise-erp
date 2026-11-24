"""Create DocTemplateField table."""

from collections.abc import Sequence

from alembic import op

revision: str = "0326_doc_template_field"
down_revision: str | None = "0325_doc_template"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    try:
        from modules.document.models.template_field import DocTemplateField  # noqa: F401
    except ModuleNotFoundError:
        return
    DocTemplateField.__table__.create(bind=op.get_bind(), checkfirst=True)


def downgrade() -> None:
    try:
        from modules.document.models.template_field import DocTemplateField  # noqa: F401
    except ModuleNotFoundError:
        return
    DocTemplateField.__table__.drop(bind=op.get_bind(), checkfirst=True)
