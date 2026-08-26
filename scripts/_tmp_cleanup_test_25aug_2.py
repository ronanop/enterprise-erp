"""Soft-delete test_25AUG_2 demo CRM data (leads, opportunities, quotes, OVFs, attachments)."""

from __future__ import annotations

import sys
from datetime import datetime, timezone

sys.path.insert(0, "src")

from sqlalchemy import create_engine, text

from core.config import settings

NOW = datetime.now(timezone.utc)
PATTERN = "%test_25AUG_2%"
OPP_CODES = (
    "OPP-2026-000024",
    "OPP-2026-000025",
    "OPP-2026-000026",
    "OPP-2026-000027",
    "OPP-2026-000028",
)


def main() -> None:
    engine = create_engine(str(settings.database_url))
    with engine.begin() as conn:
        opps = conn.execute(
            text(
                """
                select id::text, opportunity_code, opportunity_name, lead_id::text
                from crm.crm_opportunity
                where is_deleted = false
                  and (
                    opportunity_code = any(:codes)
                    or opportunity_name ilike :pat
                  )
                """
            ),
            {"codes": list(OPP_CODES), "pat": PATTERN},
        ).fetchall()
        print(f"opportunities matched: {len(opps)}")
        for row in opps:
            print(f"  {row.opportunity_code} {row.opportunity_name} ({row.id})")

        opp_ids = [row.id for row in opps]
        lead_ids = [row.lead_id for row in opps if row.lead_id]

        # Also catch leftover demo leads by name/code even if convert failed mid-way
        extra_leads = conn.execute(
            text(
                """
                select id::text, lead_code, first_name, last_name
                from crm.crm_lead
                where is_deleted = false
                  and (
                    id::text = any(:ids)
                    or first_name ilike :pat
                    or project_title ilike :pat
                    or lead_code in (
                      'LEAD-2026-000025','LEAD-2026-000026','LEAD-2026-000027',
                      'LEAD-2026-000028','LEAD-2026-000029'
                    )
                  )
                """
            ),
            {"ids": lead_ids or ["00000000-0000-0000-0000-000000000000"], "pat": PATTERN},
        ).fetchall()
        for row in extra_leads:
            if row.id not in lead_ids:
                lead_ids.append(row.id)
        print(f"leads matched: {len(lead_ids)}")

        quotes = []
        ovfs = []
        if opp_ids:
            quotes = conn.execute(
                text(
                    """
                    select id::text, quote_no, opportunity_id::text
                    from crm.crm_quote
                    where is_deleted = false and opportunity_id::text = any(:ids)
                    """
                ),
                {"ids": opp_ids},
            ).fetchall()
            print(f"quotes matched: {len(quotes)}")
            for row in quotes:
                print(f"  {row.quote_no} ({row.id})")

            quote_ids = [row.id for row in quotes]
            if quote_ids:
                ovfs = conn.execute(
                    text(
                        """
                        select id::text, ovf_no, quote_id::text
                        from crm.crm_ovf
                        where is_deleted = false and quote_id::text = any(:ids)
                        """
                    ),
                    {"ids": quote_ids},
                ).fetchall()
            # Also match OVF by opportunity
            more_ovfs = conn.execute(
                text(
                    """
                    select id::text, ovf_no, quote_id::text
                    from crm.crm_ovf
                    where is_deleted = false and opportunity_id::text = any(:ids)
                    """
                ),
                {"ids": opp_ids},
            ).fetchall()
            seen = {o.id for o in ovfs}
            for row in more_ovfs:
                if row.id not in seen:
                    ovfs.append(row)
            print(f"ovfs matched: {len(ovfs)}")
            for row in ovfs:
                print(f"  {row.ovf_no} ({row.id})")

        ovf_ids = [row.id for row in ovfs]
        quote_ids = [row.id for row in quotes]

        def soft_delete(table: str, ids: list[str], label: str) -> int:
            if not ids:
                return 0
            result = conn.execute(
                text(
                    f"""
                    update {table}
                    set is_deleted = true,
                        deleted_at = :now,
                        updated_at = :now
                    where id::text = any(:ids) and is_deleted = false
                    """
                ),
                {"ids": ids, "now": NOW},
            )
            print(f"soft-deleted {label}: {result.rowcount}")
            return result.rowcount

        # Child lines first
        if ovf_ids:
            soft_delete("crm.crm_ovf_line", [], "ovf_lines(placeholder)")
            n = conn.execute(
                text(
                    """
                    update crm.crm_ovf_line
                    set is_deleted = true, deleted_at = :now, updated_at = :now
                    where ovf_id::text = any(:ids) and is_deleted = false
                    """
                ),
                {"ids": ovf_ids, "now": NOW},
            ).rowcount
            print(f"soft-deleted ovf_lines: {n}")

        if quote_ids:
            n = conn.execute(
                text(
                    """
                    update crm.crm_quote_line
                    set is_deleted = true, deleted_at = :now, updated_at = :now
                    where quote_id::text = any(:ids) and is_deleted = false
                    """
                ),
                {"ids": quote_ids, "now": NOW},
            ).rowcount
            print(f"soft-deleted quote_lines: {n}")

        # Attachments linked to these entities
        entity_ids = opp_ids + quote_ids + ovf_ids + lead_ids
        if entity_ids:
            n = conn.execute(
                text(
                    """
                    update crm.crm_attachment
                    set is_deleted = true, deleted_at = :now, updated_at = :now
                    where entity_id::text = any(:ids) and is_deleted = false
                    """
                ),
                {"ids": entity_ids, "now": NOW},
            ).rowcount
            print(f"soft-deleted attachments: {n}")

            # Approval tasks if present
            try:
                n = conn.execute(
                    text(
                        """
                        update crm.crm_approval_task
                        set is_deleted = true, deleted_at = :now, updated_at = :now
                        where entity_id::text = any(:ids) and is_deleted = false
                        """
                    ),
                    {"ids": entity_ids, "now": NOW},
                ).rowcount
                print(f"soft-deleted approval_tasks: {n}")
            except Exception as exc:
                print(f"approval_tasks skip: {type(exc).__name__}: {exc}")

        soft_delete("crm.crm_ovf", ovf_ids, "ovfs")
        soft_delete("crm.crm_quote", quote_ids, "quotes")
        soft_delete("crm.crm_opportunity", opp_ids, "opportunities")
        soft_delete("crm.crm_lead", lead_ids, "leads")

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
        print("remaining active opportunities:", [r[0] for r in remaining] or "none")


if __name__ == "__main__":
    main()
