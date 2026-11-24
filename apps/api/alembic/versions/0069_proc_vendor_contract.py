"""Create proc_vendor_contract table."""

from collections.abc import Sequence

from alembic import op

revision: str = "0069_proc_vendor_contract"
down_revision: str | None = "0068_proc_grn_line"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    try:
        from modules.procurement.models.contract import ProcVendorContract  # noqa: F401
    except ModuleNotFoundError:
        return
    ProcVendorContract.__table__.create(bind=op.get_bind(), checkfirst=True)


def downgrade() -> None:
    try:
        from modules.procurement.models.contract import ProcVendorContract  # noqa: F401
    except ModuleNotFoundError:
        return
    ProcVendorContract.__table__.drop(bind=op.get_bind(), checkfirst=True)
