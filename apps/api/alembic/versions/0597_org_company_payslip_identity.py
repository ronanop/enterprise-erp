"""Company logo, TAN, and address for payslip letterhead."""

from __future__ import annotations

import sys
from pathlib import Path

import sqlalchemy as sa
from alembic import op

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))

from helpers import column_exists

revision: str = "0597_org_company_payslip_identity"
down_revision: str | None = "0596_master_employee_contact_encrypt"
branch_labels = None
depends_on = None

_SCHEMA = "organization"
_TABLE = "org_company"


def upgrade() -> None:
    bind = op.get_bind()
    columns = {
        "tan_number": sa.String(32),
        "logo_url": sa.Text(),
        "address_line1": sa.String(255),
        "address_line2": sa.String(255),
        "city": sa.String(100),
        "state_name": sa.String(100),
        "postal_code": sa.String(20),
    }
    for name, col_type in columns.items():
        if not column_exists(bind, _TABLE, name, schema=_SCHEMA):
            op.add_column(_TABLE, sa.Column(name, col_type, nullable=True), schema=_SCHEMA)


def downgrade() -> None:
    bind = op.get_bind()
    for name in (
        "postal_code",
        "state_name",
        "city",
        "address_line2",
        "address_line1",
        "logo_url",
        "tan_number",
    ):
        if column_exists(bind, _TABLE, name, schema=_SCHEMA):
            op.drop_column(_TABLE, name, schema=_SCHEMA)
