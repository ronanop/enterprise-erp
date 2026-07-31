"""Remove rows created by seed_asset_mock_data / seed_asset_mock_dependents.

Usage (from apps/api):
  .venv\\Scripts\\python.exe -m scripts.purge_asset_mock_data
"""

from __future__ import annotations

import sys

sys.path.insert(0, "src")

from sqlalchemy import create_engine, text
from sqlalchemy.orm import sessionmaker

from core.config import get_settings

MOCK_ASSET_NAMES = (
    "Dell Latitude 5540",
    "Herman Miller Chair",
    "Toyota Innova Crysta",
    "Old Keyboard Batch A",
    "Retired Monitor 24in",
    "Scrap Docking Station",
)

MOCK_SERIAL_PREFIXES = ("SN-DELL-5540-01", "SN-HM-CHAIR-02", "SN-INN-CRY-03", "SCRAP-")

MOCK_CATEGORY_CODES = ("IT-HW", "FURN", "VEH")

MOCK_POLICY_NUMBERS = (
    "POL-IT-2025-001",
    "POL-VEH-2025-014",
    "POL-FURN-2025-003",
)

# Tables with asset_id column (delete children before assets).
ASSET_CHILD_TABLES = (
    "ast_asset_service_history",
    "ast_asset_maintenance",
    "ast_asset_notification",
    "ast_asset_document",
    "ast_asset_meter_reading",
    "ast_asset_audit",
    "ast_asset_disposal",
    "ast_asset_revaluation",
    "ast_asset_depreciation",
    "ast_asset_transfer",
    "ast_asset_assignment",
    "ast_asset_component",
    "ast_asset_location",
    "ast_asset_warranty",
    "ast_asset_insurance",
    "ast_asset_maintenance_plan",
)


def main() -> None:
    engine = create_engine(str(get_settings().database_url), pool_pre_ping=True)
    db = sessionmaker(bind=engine)()
    try:
        name_params = {f"n{i}": n for i, n in enumerate(MOCK_ASSET_NAMES)}
        name_list = ", ".join(f":n{i}" for i in range(len(MOCK_ASSET_NAMES)))

        asset_rows = db.execute(
            text(
                f"""
                select id from asset.ast_asset
                where is_deleted is false
                  and (
                    asset_name in ({name_list})
                    or serial_number like 'SCRAP-%'
                  )
                """
            ),
            name_params,
        ).fetchall()
        asset_ids = [str(r[0]) for r in asset_rows]

        if not asset_ids:
            print("No mock assets found — nothing to purge.")
            return

        print(f"Purging {len(asset_ids)} mock asset(s) and dependents…")
        id_params = {f"a{i}": aid for i, aid in enumerate(asset_ids)}
        id_list = ", ".join(f":a{i}" for i in range(len(asset_ids)))

        counts: dict[str, int] = {}
        for table in ASSET_CHILD_TABLES:
            result = db.execute(
                text(
                    f"""
                    update asset.{table}
                    set is_deleted = true, updated_at = now()
                    where is_deleted is false and asset_id in ({id_list})
                    """
                ),
                id_params,
            )
            counts[table] = result.rowcount

        # Checklists tied to mock assets or known mock titles.
        chk = db.execute(
            text(
                f"""
                update asset.ast_asset_checklist
                set is_deleted = true, updated_at = now()
                where is_deleted is false
                  and (
                    asset_id in ({id_list})
                    or checklist_name ilike any (array[
                      'Laptop handover checklist',
                      'Laptop handover',
                      'Vehicle pre-trip checklist',
                      'Vehicle pre-trip',
                      'Generic asset inspection',
                      'Generic inspection'
                    ])
                    or checklist_code like 'CHK-LAP-%'
                    or checklist_code like 'CHK-VEH-%'
                    or checklist_code like 'CHK-GEN-%'
                  )
                """
            ),
            id_params,
        )
        counts["ast_asset_checklist"] = chk.rowcount

        # Orphan insurance rows by policy number (if asset link broken).
        pol_params = {f"p{i}": p for i, p in enumerate(MOCK_POLICY_NUMBERS)}
        pol_list = ", ".join(f":p{i}" for i in range(len(MOCK_POLICY_NUMBERS)))
        ins = db.execute(
            text(
                f"""
                update asset.ast_asset_insurance
                set is_deleted = true, updated_at = now()
                where is_deleted is false and policy_number in ({pol_list})
                """
            ),
            pol_params,
        )
        counts["ast_asset_insurance_policies"] = ins.rowcount

        assets = db.execute(
            text(
                f"""
                update asset.ast_asset
                set is_deleted = true, updated_at = now()
                where is_deleted is false and id in ({id_list})
                """
            ),
            id_params,
        )
        counts["ast_asset"] = assets.rowcount

        # Categories only when no active assets remain.
        cat_params = {f"c{i}": c for i, c in enumerate(MOCK_CATEGORY_CODES)}
        cat_list = ", ".join(f":c{i}" for i in range(len(MOCK_CATEGORY_CODES)))
        cats = db.execute(
            text(
                f"""
                update asset.ast_asset_category c
                set is_deleted = true, updated_at = now()
                where c.is_deleted is false
                  and c.category_code in ({cat_list})
                  and not exists (
                    select 1 from asset.ast_asset a
                    where a.asset_category_id = c.id
                      and a.is_deleted is false
                  )
                """
            ),
            cat_params,
        )
        counts["ast_asset_category"] = cats.rowcount

        # Mock employees created by seed script.
        try:
            emps = db.execute(
                text(
                    """
                    update master.master_employee
                    set is_deleted = true, updated_at = now()
                    where is_deleted is false
                      and (
                        email like 'mock.asset.%@example.com'
                        or employee_code like 'MOCK-EMP-%'
                      )
                    """
                )
            )
            counts["master_employee"] = emps.rowcount
        except Exception as exc:  # noqa: BLE001
            print(f"  (skip mock employees: {exc})")

        db.commit()

        print("=== PURGE SUMMARY (rows soft-deleted) ===")
        for key, n in counts.items():
            if n:
                print(f"  {key}: {n}")
        print("Done. Refresh the Assets UI.")
    except Exception:
        db.rollback()
        raise
    finally:
        db.close()


if __name__ == "__main__":
    main()
