"""Seed CRM lead sources, selling entities, and default pipelines (idempotent)."""

from __future__ import annotations

import json
from uuid import UUID, uuid4

from sqlalchemy import text

from database.session import SessionLocal

NIL = UUID("00000000-0000-0000-0000-000000000000")

# Keep in sync with company Source dropdown (apps/web company-form-page SOURCES).
LEAD_SOURCES = (
    ("REFERRAL", "Referral"),
    ("WEB", "Website"),
    ("COLD_CALL", "Cold Call"),
    ("MULTI_TIER", "Multi-Tier"),
    ("EVENT", "Event"),
    ("ADVERTISEMENT", "Advertisement"),
    ("OTHER", "Other"),
)

SELLING_ENTITIES = (
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
        "07AAMCV4044L1ZW",
        (
            "L-32 F/F, Kailash Colony, Near Summer Field School, Kailash Colony, "
            "New Delhi, South Delhi 110048 (CIN U73200DL2026PTC468069)"
        ),
    ),
)

PIPELINE_STAGES = [
    {"code": "qualification", "name": "Qualification"},
    {"code": "discovery", "name": "Discovery"},
    {"code": "proposal", "name": "Proposal"},
    {"code": "negotiation", "name": "Negotiation"},
    {"code": "won", "name": "Won"},
    {"code": "lost", "name": "Lost"},
]


def main() -> None:
    db = SessionLocal()
    try:
        companies = db.execute(
            text(
                """
                SELECT id, tenant_id, company_code, company_name
                FROM organization.org_company
                WHERE coalesce(is_deleted, false) IS FALSE
                ORDER BY company_code
                """
            )
        ).mappings().all()
        print(f"companies={len(companies)}")

        src_added = 0
        ent_added = 0
        pipe_added = 0
        for company in companies:
            cid = company["id"]
            tid = company["tenant_id"]
            for code, name in LEAD_SOURCES:
                row = db.execute(
                    text(
                        """
                        INSERT INTO crm.crm_lead_source (
                            id, source_code, source_name, channel, status,
                            tenant_id, company_id, branch_id,
                            created_at, created_by, updated_at, updated_by, version, is_deleted
                        )
                        SELECT
                            CAST(:id AS uuid),
                            CAST(:code AS varchar(50)),
                            CAST(:name AS varchar(255)),
                            NULL,
                            'active',
                            CAST(:tid AS uuid),
                            CAST(:cid AS uuid),
                            NULL,
                            now(), CAST(:nil AS uuid), now(), CAST(:nil AS uuid), 1, false
                        WHERE NOT EXISTS (
                            SELECT 1 FROM crm.crm_lead_source s
                            WHERE s.company_id = CAST(:cid AS uuid)
                              AND s.source_code = CAST(:code AS varchar(50))
                              AND coalesce(s.is_deleted, false) IS FALSE
                        )
                        RETURNING id
                        """
                    ),
                    {
                        "id": uuid4(),
                        "code": code,
                        "name": name,
                        "tid": tid,
                        "cid": cid,
                        "nil": NIL,
                    },
                ).fetchone()
                if row:
                    src_added += 1

            for code, name, gst, address in SELLING_ENTITIES:
                row = db.execute(
                    text(
                        """
                        INSERT INTO crm.crm_selling_entity (
                            id, entity_code, entity_name, entity_email, entity_contact,
                            entity_gst, entity_address, status,
                            tenant_id, company_id,
                            created_at, created_by, updated_at, updated_by, version, is_deleted
                        )
                        SELECT
                            CAST(:id AS uuid),
                            CAST(:code AS varchar(50)),
                            CAST(:name AS varchar(255)),
                            CAST(:email AS varchar(255)),
                            CAST(:contact AS varchar(50)),
                            CAST(:gst AS varchar(30)),
                            CAST(:address AS text),
                            'active',
                            CAST(:tid AS uuid),
                            CAST(:cid AS uuid),
                            now(), CAST(:nil AS uuid), now(), CAST(:nil AS uuid), 1, false
                        WHERE NOT EXISTS (
                            SELECT 1 FROM crm.crm_selling_entity e
                            WHERE e.company_id = CAST(:cid AS uuid)
                              AND (
                                lower(e.entity_name) = lower(CAST(:name AS varchar(255)))
                                OR e.entity_code = CAST(:code AS varchar(50))
                              )
                              AND coalesce(e.is_deleted, false) IS FALSE
                        )
                        RETURNING id
                        """
                    ),
                    {
                        "id": uuid4(),
                        "code": code,
                        "name": name,
                        "email": "info@cachedigitech.com",
                        "contact": "18003094333",
                        "gst": gst,
                        "address": address,
                        "tid": tid,
                        "cid": cid,
                        "nil": NIL,
                    },
                ).fetchone()
                if row:
                    ent_added += 1

            pipe = db.execute(
                text(
                    """
                    INSERT INTO crm.crm_pipeline (
                        id, branch_id, pipeline_code, pipeline_name, is_default, status, stages_json,
                        tenant_id, company_id,
                        created_at, created_by, updated_at, updated_by, version, is_deleted
                    )
                    SELECT
                        CAST(:id AS uuid), NULL,
                        CAST(:code AS varchar(50)), CAST(:name AS varchar(255)),
                        true, 'active', CAST(:stages AS jsonb),
                        CAST(:tid AS uuid), CAST(:cid AS uuid),
                        now(), CAST(:nil AS uuid), now(), CAST(:nil AS uuid), 1, false
                    WHERE NOT EXISTS (
                        SELECT 1 FROM crm.crm_pipeline p
                        WHERE p.company_id = CAST(:cid AS uuid)
                          AND coalesce(p.is_deleted, false) IS FALSE
                    )
                    RETURNING id
                    """
                ),
                {
                    "id": uuid4(),
                    "code": "STD",
                    "name": "Standard Pipeline",
                    "stages": json.dumps(PIPELINE_STAGES),
                    "tid": tid,
                    "cid": cid,
                    "nil": NIL,
                },
            ).fetchone()
            if pipe:
                pipe_added += 1

            print(f"  {company['company_code']}: sources/entities/pipeline seeded for company")

        db.commit()
        print(f"done src_added={src_added} ent_added={ent_added} pipe_added={pipe_added}")

        # verify
        for company in companies:
            sc = db.execute(
                text(
                    "SELECT count(*) FROM crm.crm_lead_source WHERE company_id=:c AND coalesce(is_deleted,false)=false"
                ),
                {"c": company["id"]},
            ).scalar()
            ec = db.execute(
                text(
                    "SELECT count(*) FROM crm.crm_selling_entity WHERE company_id=:c AND coalesce(is_deleted,false)=false"
                ),
                {"c": company["id"]},
            ).scalar()
            pc = db.execute(
                text(
                    "SELECT count(*) FROM crm.crm_pipeline WHERE company_id=:c AND coalesce(is_deleted,false)=false"
                ),
                {"c": company["id"]},
            ).scalar()
            print(f"  {company['company_code']}: sources={sc} entities={ec} pipelines={pc}")
    except Exception:
        db.rollback()
        raise
    finally:
        db.close()


if __name__ == "__main__":
    main()
