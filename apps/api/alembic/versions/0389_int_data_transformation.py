"""Create IntDataTransformation table."""

from collections.abc import Sequence

from alembic import op

revision: str = "0389_int_data_transformation"
down_revision: str | None = "0388_int_data_mapping"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    try:
        from modules.integration.models.data_transformation import IntDataTransformation  # noqa: F401
    except ModuleNotFoundError:
        return
    IntDataTransformation.__table__.create(bind=op.get_bind(), checkfirst=True)


def downgrade() -> None:
    try:
        from modules.integration.models.data_transformation import IntDataTransformation  # noqa: F401
    except ModuleNotFoundError:
        return
    IntDataTransformation.__table__.drop(bind=op.get_bind(), checkfirst=True)
