"""Add custom_fields JSONB on CRM lead and company for Settings form builder."""

from collections.abc import Sequence

from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects.postgresql import JSONB

revision: str = "0674_crm_custom_fields_jsonb"
down_revision: str | Sequence[str] | None = "0673_crm_tenant_settings"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


_TABLES = (
    "crm_lead",
    "crm_company",
    "crm_opportunity",
    "crm_quote",
    "crm_ovf",
    "crm_contact",
)


def upgrade() -> None:
    for table in _TABLES:
        op.add_column(
            table,
            sa.Column("custom_fields", JSONB, nullable=False, server_default=sa.text("'{}'::jsonb")),
            schema="crm",
        )


def downgrade() -> None:
    for table in reversed(_TABLES):
        op.drop_column(table, "custom_fields", schema="crm")
