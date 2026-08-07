"""CRM selling / billing entity master and seed Cache group entities."""

from collections.abc import Sequence
from pathlib import Path
import sys

import sqlalchemy as sa
from alembic import op

sys.path.insert(0, str(Path(__file__).resolve().parents[2] / "src"))

from modules.crm.models.selling_entity import CrmSellingEntity  # noqa: E402,F401

revision: str = "0494_crm_selling_entity"
down_revision: str | None = "0493_crm_lead_designation"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None

_SEED_ROWS: tuple[tuple[str, str, str | None, str], ...] = (
    (
        "ENT-000001",
        "CACHE DIGITECH PVT LTD (Delhi)",
        "07AAACC4248H1ZU",
        "L-31, Kailash Colony, New Delhi, South Delhi, Delhi 110048",
    ),
    (
        "ENT-000002",
        "CACHE DIGITECH PVT LTD (Mumbai)",
        "27AAACC4248H1ZS",
        (
            "404, C-Wing, Eastern Court Junction, Tejpal & Parleshwar Road, "
            "Vile Parle East, Mumbai Suburban, Maharashtra 400057"
        ),
    ),
    (
        "ENT-000003",
        "CACHE TECHNOLOGIES",
        "07AAWPG7418G2ZC",
        "G/F, L-31, Kailash Colony, New Delhi, South Delhi, Delhi 110048",
    ),
    (
        "ENT-000004",
        "CALIPERS CONSULTING PRIVATE LIMITED",
        "07AAJCC7530P1Z5",
        "L-31, Kailash Colony, New Delhi, South Delhi, Delhi 110048",
    ),
    (
        "ENT-000005",
        "VYUHA AI LABS PRIVATE LIMITED",
        None,
        (
            "L-32 F/F, Kailash Colony, Near Summer Field School, Kailash Colony, "
            "New Delhi, South Delhi 110048 (CIN U73200DL2026PTC468069)"
        ),
    ),
)


def upgrade() -> None:
    bind = op.get_bind()
    CrmSellingEntity.__table__.create(bind=bind, checkfirst=True)

    for code, name, gst, address in _SEED_ROWS:
        bind.execute(
            sa.text(
                """
                INSERT INTO crm.crm_selling_entity (
                    id,
                    entity_code,
                    entity_name,
                    entity_email,
                    entity_contact,
                    entity_gst,
                    entity_address,
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
                    CAST(:entity_code AS VARCHAR(50)),
                    CAST(:entity_name AS VARCHAR(255)),
                    NULL,
                    NULL,
                    CAST(:entity_gst AS VARCHAR(30)),
                    CAST(:entity_address AS TEXT),
                    'active',
                    c.tenant_id,
                    c.id,
                    now(),
                    '00000000-0000-0000-0000-000000000000'::uuid,
                    now(),
                    '00000000-0000-0000-0000-000000000000'::uuid,
                    1,
                    false
                FROM organization.org_company c
                WHERE c.company_code = 'DEMOCO'
                  AND coalesce(c.is_deleted, false) IS FALSE
                  AND NOT EXISTS (
                      SELECT 1
                      FROM crm.crm_selling_entity e
                      WHERE e.company_id = c.id
                        AND lower(e.entity_name) = lower(:entity_name)
                        AND coalesce(e.is_deleted, false) IS FALSE
                  )
                """
            ),
            {
                "entity_code": code,
                "entity_name": name,
                "entity_gst": gst,
                "entity_address": address,
            },
        )


def downgrade() -> None:
    bind = op.get_bind()
    CrmSellingEntity.__table__.drop(bind=bind, checkfirst=True)
