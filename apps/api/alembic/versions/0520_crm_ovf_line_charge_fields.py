"""Add vendor charge fields on CRM OVF lines (distributor, contacts, description).

Revision id matches environments already stamped as 0520_crm_ovf_line_charge_fields.
"""

import sys
from collections.abc import Sequence
from pathlib import Path

import sqlalchemy as sa
from alembic import op

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))

from helpers import column_exists  # noqa: E402

revision: str = "0520_crm_ovf_line_charge_fields"
down_revision: str | Sequence[str] | None = "0519_mkt_operations_platform"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None

_COLUMNS: tuple[tuple[str, sa.types.TypeEngine], ...] = (
    ("description", sa.Text()),
    ("distributor_name", sa.String(length=255)),
    ("contact_person", sa.String(length=255)),
    ("contact_number", sa.String(length=50)),
)


def upgrade() -> None:
    bind = op.get_bind()
    for name, col_type in _COLUMNS:
        if column_exists(bind, "crm_ovf_line", name, schema="crm"):
            continue
        op.add_column(
            "crm_ovf_line",
            sa.Column(name, col_type, nullable=True),
            schema="crm",
        )


def downgrade() -> None:
    bind = op.get_bind()
    for name, _ in reversed(_COLUMNS):
        if not column_exists(bind, "crm_ovf_line", name, schema="crm"):
            continue
        op.drop_column("crm_ovf_line", name, schema="crm")
