"""Restore approval tasks wrongly soft-deleted during test_25AUG_2 cleanup.

Keeps soft-delete on demo leads/opps/quotes/ovfs/attachments; only restores
approval_tasks whose entity_id is NOT part of that demo set.
"""

from __future__ import annotations

import sys
from datetime import datetime, timezone, timedelta

sys.path.insert(0, "src")

from sqlalchemy import create_engine, text

from core.config import settings

PATTERN = "%test_25AUG_2%"
OPP_CODES = (
    "OPP-2026-000024",
    "OPP-2026-000025",
    "OPP-2026-000026",
    "OPP-2026-000027",
    "OPP-2026-000028",
)
LEAD_CODES = (
    "LEAD-2026-000025",
    "LEAD-2026-000026",
    "LEAD-2026-000027",
    "LEAD-2026-000028",
    "LEAD-2026-000029",
)


def main() -> None:
    engine = create_engine(str(settings.database_url))
    cutoff = datetime.now(timezone.utc) - timedelta(minutes=60)

    with engine.begin() as conn:
        opp_ids = [
            r[0]
            for r in conn.execute(
                text(
                    """
                    select id::text from crm.crm_opportunity
                    where opportunity_code = any(:codes)
                       or opportunity_name ilike :pat
                    """
                ),
                {"codes": list(OPP_CODES), "pat": PATTERN},
            ).fetchall()
        ]
        lead_ids = [
            r[0]
            for r in conn.execute(
                text(
                    """
                    select id::text from crm.crm_lead
                    where lead_code = any(:codes)
                       or first_name ilike :pat
                       or project_title ilike :pat
                    """
                ),
                {"codes": list(LEAD_CODES), "pat": PATTERN},
            ).fetchall()
        ]
        quote_ids = [
            r[0]
            for r in conn.execute(
                text(
                    """
                    select id::text from crm.crm_quote
                    where opportunity_id::text = any(:ids)
                    """
                ),
                {"ids": opp_ids or ["00000000-0000-0000-0000-000000000000"]},
            ).fetchall()
        ]
        ovf_ids = [
            r[0]
            for r in conn.execute(
                text(
                    """
                    select id::text from crm.crm_ovf
                    where opportunity_id::text = any(:oids)
                       or quote_id::text = any(:qids)
                    """
                ),
                {
                    "oids": opp_ids or ["00000000-0000-0000-0000-000000000000"],
                    "qids": quote_ids or ["00000000-0000-0000-0000-000000000000"],
                },
            ).fetchall()
        ]

        demo_ids = list({*opp_ids, *lead_ids, *quote_ids, *ovf_ids})
        print(f"demo entity ids to keep deleted: {len(demo_ids)}")
        print(f"  opps={len(opp_ids)} leads={len(lead_ids)} quotes={len(quote_ids)} ovfs={len(ovf_ids)}")

        # Diagnose: how many recently deleted tasks are outside demo set?
        stats = conn.execute(
            text(
                """
                select
                  count(*) filter (
                    where entity_id::text = any(:demo)
                  ) as demo_tasks,
                  count(*) filter (
                    where not (entity_id::text = any(:demo))
                  ) as other_tasks
                from crm.crm_approval_task
                where is_deleted = true
                  and deleted_at >= :cutoff
                """
            ),
            {"demo": demo_ids or ["00000000-0000-0000-0000-000000000000"], "cutoff": cutoff},
        ).one()
        print(f"recently deleted approval_tasks: demo={stats.demo_tasks} other={stats.other_tasks}")

        # Restore non-demo tasks deleted in this cleanup window
        restored = conn.execute(
            text(
                """
                update crm.crm_approval_task
                set is_deleted = false,
                    deleted_at = null,
                    updated_at = now()
                where is_deleted = true
                  and deleted_at >= :cutoff
                  and not (entity_id::text = any(:demo))
                """
            ),
            {"demo": demo_ids or ["00000000-0000-0000-0000-000000000000"], "cutoff": cutoff},
        ).rowcount
        print(f"restored approval_tasks: {restored}")

        active = conn.execute(
            text("select count(*) from crm.crm_approval_task where is_deleted = false")
        ).scalar()
        still_demo = conn.execute(
            text(
                """
                select count(*) from crm.crm_approval_task
                where is_deleted = true and entity_id::text = any(:demo)
                """
            ),
            {"demo": demo_ids or ["00000000-0000-0000-0000-000000000000"]},
        ).scalar()
        print(f"active approval_tasks now: {active}")
        print(f"demo approval_tasks still soft-deleted: {still_demo}")

        # Confirm demo opportunities stay gone from UI
        remaining = conn.execute(
            text(
                """
                select opportunity_code from crm.crm_opportunity
                where is_deleted = false
                  and (
                    opportunity_code = any(:codes)
                    or opportunity_name ilike :pat
                  )
                """
            ),
            {"codes": list(OPP_CODES), "pat": PATTERN},
        ).fetchall()
        print("remaining active demo opportunities:", [r[0] for r in remaining] or "none")


if __name__ == "__main__":
    main()
