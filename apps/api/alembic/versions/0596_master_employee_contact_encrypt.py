"""Encrypt master employee email and mobile; keep HMAC columns for lookup."""

from __future__ import annotations

import sys
from pathlib import Path

import sqlalchemy as sa
from alembic import op

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))
sys.path.insert(0, str(Path(__file__).resolve().parents[2] / "src"))

from helpers import column_exists, index_exists, table_exists
from security.field_crypto import encrypt_str, is_encrypted, pii_lookup

revision: str = "0596_master_employee_contact_encrypt"
down_revision: str | None = "0595_hr_pii_encrypt"
branch_labels = None
depends_on = None

_TABLE = "master_employee"
_SCHEMA = "master"


def upgrade() -> None:
    bind = op.get_bind()
    if not table_exists(bind, _TABLE, schema=_SCHEMA):
        return
    if not column_exists(bind, _TABLE, "email_lookup", schema=_SCHEMA):
        op.add_column(_TABLE, sa.Column("email_lookup", sa.String(64), nullable=True), schema=_SCHEMA)
    if not column_exists(bind, _TABLE, "mobile_lookup", schema=_SCHEMA):
        op.add_column(_TABLE, sa.Column("mobile_lookup", sa.String(64), nullable=True), schema=_SCHEMA)
    for column in ("email", "mobile"):
        op.alter_column(
            _TABLE,
            column,
            existing_type=sa.String(),
            type_=sa.Text(),
            schema=_SCHEMA,
        )
    if index_exists(bind, _TABLE, "ix_master_employee_email", schema=_SCHEMA):
        op.drop_index("ix_master_employee_email", table_name=_TABLE, schema=_SCHEMA)
    op.execute(sa.text(f"ALTER TABLE {_SCHEMA}.{_TABLE} DROP CONSTRAINT IF EXISTS uk_master_employee_company_email"))
    _backfill()
    op.alter_column(_TABLE, "email_lookup", existing_type=sa.String(64), nullable=False, schema=_SCHEMA)
    op.alter_column(_TABLE, "mobile_lookup", existing_type=sa.String(64), nullable=False, schema=_SCHEMA)
    op.create_unique_constraint(
        "uk_master_employee_company_email",
        _TABLE,
        ["company_id", "email_lookup"],
        schema=_SCHEMA,
    )
    if not index_exists(bind, _TABLE, "ix_master_employee_email_lookup", schema=_SCHEMA):
        op.create_index("ix_master_employee_email_lookup", _TABLE, ["email_lookup"], schema=_SCHEMA)


def _backfill() -> None:
    conn = op.get_bind()
    rows = conn.execute(sa.text(f"SELECT id, email, mobile FROM {_SCHEMA}.{_TABLE}")).mappings()
    for row in rows:
        params: dict[str, object] = {"id": row["id"]}
        sets: list[str] = []
        for column, lookup_column in (("email", "email_lookup"), ("mobile", "mobile_lookup")):
            value = row[column]
            if not value:
                params[lookup_column] = ""
                sets.append(f"{lookup_column} = :{lookup_column}")
                continue
            text = str(value)
            plain = text
            if not is_encrypted(text):
                params[column] = encrypt_str(text)
                sets.append(f"{column} = :{column}")
            lookup = pii_lookup(plain if not is_encrypted(plain) else None)
            if lookup:
                params[lookup_column] = lookup
                sets.append(f"{lookup_column} = :{lookup_column}")
        if not sets:
            continue
        conn.execute(
            sa.text(f"UPDATE {_SCHEMA}.{_TABLE} SET {', '.join(sets)} WHERE id = :id"),
            params,
        )


def downgrade() -> None:
    bind = op.get_bind()
    if not table_exists(bind, _TABLE, schema=_SCHEMA):
        return
    op.execute(sa.text(f"ALTER TABLE {_SCHEMA}.{_TABLE} DROP CONSTRAINT IF EXISTS uk_master_employee_company_email"))
    if index_exists(bind, _TABLE, "ix_master_employee_email_lookup", schema=_SCHEMA):
        op.drop_index("ix_master_employee_email_lookup", table_name=_TABLE, schema=_SCHEMA)
    if column_exists(bind, _TABLE, "email_lookup", schema=_SCHEMA):
        op.drop_column(_TABLE, "email_lookup", schema=_SCHEMA)
    if column_exists(bind, _TABLE, "mobile_lookup", schema=_SCHEMA):
        op.drop_column(_TABLE, "mobile_lookup", schema=_SCHEMA)
