"""Add editable inherited snapshot fields to CRM OVF."""

from collections.abc import Sequence

import sqlalchemy as sa
from alembic import op

revision: str = "0447_crm_ovf_snapshot"
down_revision: str | None = "0446_crm_lead_contacts"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    columns = (
        sa.Column("customer_name", sa.String(length=255), nullable=True),
        sa.Column("quote_name", sa.String(length=255), nullable=True),
        sa.Column("billing_address", sa.Text(), nullable=True),
        sa.Column("billing_state", sa.String(length=100), nullable=True),
        sa.Column("billing_country", sa.String(length=100), nullable=True),
        sa.Column("owner_name", sa.String(length=255), nullable=True),
        sa.Column("billing_contact_person", sa.String(length=255), nullable=True),
        sa.Column("shipping_address", sa.Text(), nullable=True),
        sa.Column("shipping_state", sa.String(length=100), nullable=True),
        sa.Column("shipping_country", sa.String(length=100), nullable=True),
        sa.Column("shipping_contact_person", sa.String(length=255), nullable=True),
        sa.Column("account_name", sa.String(length=255), nullable=True),
    )
    for column in columns:
        op.add_column("crm_ovf", column, schema="crm")


def downgrade() -> None:
    for column_name in (
        "account_name",
        "shipping_contact_person",
        "shipping_country",
        "shipping_state",
        "shipping_address",
        "billing_contact_person",
        "owner_name",
        "billing_country",
        "billing_state",
        "billing_address",
        "quote_name",
        "customer_name",
    ):
        op.drop_column("crm_ovf", column_name, schema="crm")
