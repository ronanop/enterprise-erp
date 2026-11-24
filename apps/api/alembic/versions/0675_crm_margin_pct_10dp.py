"""Widen CRM margin % columns to 10 decimal places."""

from collections.abc import Sequence

from alembic import op
import sqlalchemy as sa

revision: str = "0675_crm_margin_pct_10dp"
down_revision: str | Sequence[str] | None = "0674_crm_custom_fields_jsonb"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None

_PCT = sa.Numeric(22, 10)
_LEGACY = sa.Numeric(6, 3)

_COLUMNS: tuple[tuple[str, str, bool], ...] = (
    ("crm_quote", "avg_margin_pct", False),
    ("crm_quote_line", "margin_pct", False),
    ("crm_quote_revision_snapshot", "avg_margin_pct", False),
    ("crm_ovf", "total_margin_pct", False),
    ("crm_ovf", "margin_at_approval_pct", True),
    ("crm_ovf", "live_margin_pct", True),
)


def upgrade() -> None:
    for table, column, nullable in _COLUMNS:
        op.alter_column(
            table,
            column,
            existing_type=_LEGACY,
            type_=_PCT,
            existing_nullable=nullable,
            schema="crm",
        )


def downgrade() -> None:
    for table, column, nullable in reversed(_COLUMNS):
        op.alter_column(
            table,
            column,
            existing_type=_PCT,
            type_=_LEGACY,
            existing_nullable=nullable,
            schema="crm",
        )
