"""Create master reference tables: uom, currency, tax."""

from collections.abc import Sequence

from alembic import op

revision: str = "0014_master_reference_tables"
down_revision: str | None = "0013_create_master_schema"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    try:
        from modules.master_data.models.reference import MasterCurrency, MasterTax, MasterUom  # noqa: F401
    except ModuleNotFoundError:
        return
    MasterCurrency.__table__.create(bind=op.get_bind(), checkfirst=True)


def downgrade() -> None:
    try:
        from modules.master_data.models.reference import MasterCurrency, MasterTax, MasterUom  # noqa: F401
    except ModuleNotFoundError:
        return
    MasterCurrency.__table__.drop(bind=op.get_bind(), checkfirst=True)
