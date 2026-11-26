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
    bind = op.get_bind()
    # Order: currency/uom/tax have no mutual FKs; create all three.
    MasterCurrency.__table__.create(bind=bind, checkfirst=True)
    MasterUom.__table__.create(bind=bind, checkfirst=True)
    MasterTax.__table__.create(bind=bind, checkfirst=True)


def downgrade() -> None:
    try:
        from modules.master_data.models.reference import MasterCurrency, MasterTax, MasterUom  # noqa: F401
    except ModuleNotFoundError:
        return
    bind = op.get_bind()
    MasterTax.__table__.drop(bind=bind, checkfirst=True)
    MasterUom.__table__.drop(bind=bind, checkfirst=True)
    MasterCurrency.__table__.drop(bind=bind, checkfirst=True)
