"""Check whether recently soft-deleted approval_tasks all belong to demo entities."""

from __future__ import annotations

import sys

sys.path.insert(0, "src")

from sqlalchemy import create_engine, text

from core.config import settings

PATTERN = "%test_25AUG_2%"
OPP_CODES = [
    "OPP-2026-000024",
    "OPP-2026-000025",
    "OPP-2026-000026",
    "OPP-2026-000027",
    "OPP-2026-000028",
]
LEAD_CODES = [
    "LEAD-2026-000025",
    "LEAD-2026-000026",
    "LEAD-2026-000027",
    "LEAD-2026-000028",
    "LEAD-2026-000029",
]


def main() -> None:
    engine = create_engine(str(settings.database_url))
    with engine.connect() as conn:
        opp_ids = [
            r[0]
            for r in conn.execute(
                text(
                    "select id::text from crm.crm_opportunity "
                    "where opportunity_code = any(:codes) or opportunity_name ilike :pat"
                ),
                {"codes": OPP_CODES, "pat": PATTERN},
            )
        ]
        lead_ids = [
            r[0]
            for r in conn.execute(
                text(
                    "select id::text from crm.crm_lead "
                    "where lead_code = any(:codes) or first_name ilike :pat or project_title ilike :pat"
                ),
                {"codes": LEAD_CODES, "pat": PATTERN},
            )
        ]
        quote_ids = [
            r[0]
            for r in conn.execute(
                text(
                    "select id::text from crm.crm_quote where opportunity_id::text = any(:ids)"
                ),
                {"ids": opp_ids},
            )
        ]
        ovf_ids = [
            r[0]
            for r in conn.execute(
                text(
                    "select id::text from crm.crm_ovf "
                    "where opportunity_id::text = any(:oids) or quote_id::text = any(:qids)"
                ),
                {"oids": opp_ids, "qids": quote_ids or ["00000000-0000-0000-0000-000000000000"]},
            )
        ]
        demo = list({*opp_ids, *lead_ids, *quote_ids, *ovf_ids})
        print("demo ids", len(demo))
        for label, ids in [("opp", opp_ids), ("lead", lead_ids), ("quote", quote_ids), ("ovf", ovf_ids)]:
            print(f"  {label}: {ids}")

        # Per demo entity task counts (including already deleted)
        for eid in demo:
            n = conn.execute(
                text(
                    "select count(*) from crm.crm_approval_task where entity_id::text = :e"
                ),
                {"e": eid},
            ).scalar()
            nd = conn.execute(
                text(
                    "select count(*) from crm.crm_approval_task "
                    "where entity_id::text = :e and is_deleted = true "
                    "and deleted_at > now() - interval '2 hours'"
                ),
                {"e": eid},
            ).scalar()
            print(f"  entity {eid}: total_tasks={n} recently_deleted={nd}")

        # Recently deleted tasks whose entity is NOT in demo set
        other = conn.execute(
            text(
                """
                select entity_type, entity_id::text, count(*)
                from crm.crm_approval_task
                where is_deleted = true
                  and deleted_at > now() - interval '2 hours'
                  and entity_id::text not in :demo
                group by 1, 2
                order by 3 desc
                limit 30
                """
            ).bindparams(),
            # use expanding via raw workaround
        )
        # expanding bind
        from sqlalchemy import bindparam

        stmt = text(
            """
            select entity_type, entity_id::text, count(*) as n
            from crm.crm_approval_task
            where is_deleted = true
              and deleted_at > now() - interval '2 hours'
              and entity_id::text not in :demo
            group by 1, 2
            order by n desc
            limit 30
            """
        ).bindparams(bindparam("demo", expanding=True))
        rows = conn.execute(stmt, {"demo": demo}).fetchall()
        print(f"non-demo recently deleted entity groups: {len(rows)}")
        for r in rows[:20]:
            print(f"  {r.entity_type} {r.entity_id} -> {r.n}")

        total_other = conn.execute(
            text(
                """
                select count(*) from crm.crm_approval_task
                where is_deleted = true
                  and deleted_at > now() - interval '2 hours'
                  and entity_id::text not in :demo
                """
            ).bindparams(bindparam("demo", expanding=True)),
            {"demo": demo},
        ).scalar()
        print("total non-demo recently deleted tasks:", total_other)

        # Demo CRM records status
        for table, col, codes in [
            ("crm.crm_opportunity", "opportunity_code", OPP_CODES),
            ("crm.crm_lead", "lead_code", LEAD_CODES),
        ]:
            rows = conn.execute(
                text(
                    f"select {col}, is_deleted from {table} where {col} = any(:codes) order by {col}"
                ),
                {"codes": codes},
            ).fetchall()
            print(table, [(r[0], r[1]) for r in rows])


if __name__ == "__main__":
    main()
