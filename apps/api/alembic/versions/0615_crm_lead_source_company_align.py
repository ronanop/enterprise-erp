"""Align crm_lead_source options with company Source dropdown."""

from collections.abc import Sequence
from uuid import uuid4

import sqlalchemy as sa
from alembic import op

revision: str = "0615_crm_lead_source_company_align"
down_revision: str | None = "0614_crm_company_partner_names"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None

# company form SOURCES → lead source master (code, name)
TARGET_SOURCES = (
    ("REFERRAL", "Referral"),
    ("WEB", "Website"),
    ("COLD_CALL", "Cold Call"),
    ("MULTI_TIER", "Multi-Tier"),
    ("EVENT", "Event"),
    ("ADVERTISEMENT", "Advertisement"),
    ("OTHER", "Other"),
)

# Legacy codes folded into the company-aligned set.
LEGACY_RENAMES = (
    ("REF", "REFERRAL", "Referral"),
    ("PARTNER", "MULTI_TIER", "Multi-Tier"),
    ("REFERENCE", "REFERRAL", "Referral"),
)


def upgrade() -> None:
    conn = op.get_bind()
    companies = conn.execute(
        sa.text(
            """
            SELECT DISTINCT company_id, tenant_id
            FROM crm.crm_lead_source
            WHERE coalesce(is_deleted, false) = false
            UNION
            SELECT id AS company_id, tenant_id
            FROM organization.org_company
            WHERE coalesce(is_deleted, false) = false
            """
        )
    ).mappings().all()

    target_codes = {code for code, _ in TARGET_SOURCES}

    for company in companies:
        cid = company["company_id"]
        tid = company["tenant_id"]

        for old_code, new_code, new_name in LEGACY_RENAMES:
            existing_new = conn.execute(
                sa.text(
                    """
                    SELECT id FROM crm.crm_lead_source
                    WHERE company_id = :cid
                      AND source_code = :new_code
                      AND coalesce(is_deleted, false) = false
                    LIMIT 1
                    """
                ),
                {"cid": cid, "new_code": new_code},
            ).fetchone()
            if existing_new:
                conn.execute(
                    sa.text(
                        """
                        UPDATE crm.crm_lead_source
                        SET status = 'inactive',
                            updated_at = now()
                        WHERE company_id = :cid
                          AND source_code = :old_code
                          AND coalesce(is_deleted, false) = false
                        """
                    ),
                    {"cid": cid, "old_code": old_code},
                )
            else:
                conn.execute(
                    sa.text(
                        """
                        UPDATE crm.crm_lead_source
                        SET source_code = :new_code,
                            source_name = :new_name,
                            status = 'active',
                            updated_at = now()
                        WHERE company_id = :cid
                          AND source_code = :old_code
                          AND coalesce(is_deleted, false) = false
                        """
                    ),
                    {
                        "cid": cid,
                        "old_code": old_code,
                        "new_code": new_code,
                        "new_name": new_name,
                    },
                )

        for code, name in TARGET_SOURCES:
            updated = conn.execute(
                sa.text(
                    """
                    UPDATE crm.crm_lead_source
                    SET source_name = :name,
                        status = 'active',
                        updated_at = now()
                    WHERE company_id = :cid
                      AND source_code = :code
                      AND coalesce(is_deleted, false) = false
                    """
                ),
                {"cid": cid, "code": code, "name": name},
            )
            if updated.rowcount:
                continue
            conn.execute(
                sa.text(
                    """
                    INSERT INTO crm.crm_lead_source (
                        id, source_code, source_name, channel, status,
                        tenant_id, company_id, branch_id,
                        created_at, created_by, updated_at, updated_by, version, is_deleted
                    ) VALUES (
                        :id, :code, :name, NULL, 'active',
                        :tid, :cid, NULL,
                        now(), '00000000-0000-0000-0000-000000000000',
                        now(), '00000000-0000-0000-0000-000000000000',
                        1, false
                    )
                    """
                ),
                {
                    "id": uuid4(),
                    "code": code,
                    "name": name,
                    "tid": tid,
                    "cid": cid,
                },
            )

        # Keep legacy rows for existing FK references, but hide from new picks.
        conn.execute(
            sa.text(
                """
                UPDATE crm.crm_lead_source
                SET status = 'inactive',
                    updated_at = now()
                WHERE company_id = :cid
                  AND coalesce(is_deleted, false) = false
                  AND source_code NOT IN :codes
                """
            ).bindparams(sa.bindparam("codes", expanding=True)),
            {"cid": cid, "codes": sorted(target_codes)},
        )


def downgrade() -> None:
    # Non-destructive: reactivate common legacy labels; leave aligned rows in place.
    conn = op.get_bind()
    conn.execute(
        sa.text(
            """
            UPDATE crm.crm_lead_source
            SET status = 'active',
                updated_at = now()
            WHERE coalesce(is_deleted, false) = false
              AND source_code IN (
                'PHONE', 'EMAIL', 'VERBAL', 'REF', 'PARTNER', 'SOCIAL', 'REFERENCE'
              )
            """
        )
    )
