"""Add CRM OEM partner master table and backfill from leads."""

from collections.abc import Sequence
from pathlib import Path
import sys

import sqlalchemy as sa
from alembic import op

sys.path.insert(0, str(Path(__file__).resolve().parents[2] / "src"))

from modules.crm.models.oem import CrmOem  # noqa: E402,F401

revision: str = "0456_crm_oem_master"
down_revision: str | None = "0455_crm_lead_mobile_intl"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    bind = op.get_bind()
    CrmOem.__table__.create(bind=bind, checkfirst=True)

    # Backfill unique OEM names already captured on leads.
    op.execute(
        sa.text(
            """
            WITH ranked AS (
                SELECT
                    l.tenant_id,
                    l.company_id,
                    trim(l.oem_name) AS oem_name,
                    nullif(trim(l.oem_contact_person), '') AS contact_person,
                    nullif(trim(l.oem_contact_number), '') AS contact_number,
                    nullif(trim(l.oem_contact_email), '') AS contact_email,
                    coalesce(l.created_by, '00000000-0000-0000-0000-000000000000'::uuid) AS actor_id,
                    row_number() OVER (
                        PARTITION BY l.company_id, lower(trim(l.oem_name))
                        ORDER BY l.created_at ASC NULLS LAST
                    ) AS name_rank,
                    dense_rank() OVER (
                        PARTITION BY l.company_id
                        ORDER BY lower(trim(l.oem_name))
                    ) AS code_rank
                FROM crm.crm_lead l
                WHERE coalesce(l.is_deleted, false) IS FALSE
                  AND l.oem_name IS NOT NULL
                  AND trim(l.oem_name) <> ''
            )
            INSERT INTO crm.crm_oem (
                id,
                oem_code,
                oem_name,
                contact_person,
                contact_number,
                contact_email,
                status,
                tenant_id,
                company_id,
                created_at,
                created_by,
                updated_at,
                updated_by,
                version,
                is_deleted
            )
            SELECT
                gen_random_uuid(),
                'OEM-' || lpad(code_rank::text, 6, '0'),
                oem_name,
                contact_person,
                contact_number,
                contact_email,
                'active',
                tenant_id,
                company_id,
                now(),
                actor_id,
                now(),
                actor_id,
                1,
                false
            FROM ranked
            WHERE name_rank = 1
            """
        )
    )


def downgrade() -> None:
    bind = op.get_bind()
    CrmOem.__table__.drop(bind=bind, checkfirst=True)
