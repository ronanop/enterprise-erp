"""Add employee_code_prefix on organization.org_company for Excel import segregation."""

from collections.abc import Sequence

import sqlalchemy as sa
from alembic import op

from helpers import add_column_if_missing, column_exists

revision: str = "0673_org_company_emp_code_prefix"
down_revision: str | Sequence[str] | None = "0672_mkt_chat_attachments"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    add_column_if_missing(
        "org_company",
        sa.Column("employee_code_prefix", sa.String(length=20), nullable=True),
        schema="organization",
    )
    # Best-effort backfill for known Cache / Vyuha entities (letters only, no hyphen).
    op.execute(
        """
        UPDATE organization.org_company
        SET employee_code_prefix = CASE
            WHEN lower(coalesce(company_name, '') || ' ' || coalesce(legal_name, '') || ' ' || coalesce(company_code, ''))
                 LIKE '%digitech%'
                 AND lower(coalesce(company_name, '') || ' ' || coalesce(legal_name, '')) NOT LIKE '%technolog%'
                THEN 'CDPL'
            WHEN lower(coalesce(company_name, '') || ' ' || coalesce(legal_name, '') || ' ' || coalesce(company_code, ''))
                 LIKE '%technolog%'
                THEN 'CT'
            WHEN lower(coalesce(company_name, '') || ' ' || coalesce(legal_name, '') || ' ' || coalesce(company_code, ''))
                 LIKE '%vyuha%'
                THEN 'VPL'
            ELSE employee_code_prefix
        END
        WHERE is_deleted = false
          AND (employee_code_prefix IS NULL OR btrim(employee_code_prefix) = '')
        """
    )


def downgrade() -> None:
    bind = op.get_bind()
    if column_exists(bind, "org_company", "employee_code_prefix", schema="organization"):
        op.drop_column("org_company", "employee_code_prefix", schema="organization")
