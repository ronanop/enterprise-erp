#!/usr/bin/env python
"""Merge duplicate departments / designations / base locations into one shared row each.

Same name (case-insensitive) across entities → keep one survivor (prefer active +
most employee refs), remap FKs, soft-delete duplicates.

From apps/api:

  python scripts/merge_shared_org_masters.py
  python scripts/merge_shared_org_masters.py --dry-run
"""

from __future__ import annotations

import argparse
import sys
from collections import defaultdict
from pathlib import Path
from uuid import UUID

_API_ROOT = Path(__file__).resolve().parents[1]
_SRC = _API_ROOT / "src"
if str(_SRC) not in sys.path:
    sys.path.insert(0, str(_SRC))


def _norm(name: str | None) -> str:
    return (name or "").strip().lower()


def _safe_remap(conn, sql: str, keep_id: UUID, dup_id: UUID) -> int:
    """Run an optional FK remap inside a savepoint so missing tables don't abort."""
    from sqlalchemy import text

    sp = conn.begin_nested()
    try:
        res = conn.execute(text(sql), {"keep": keep_id, "dup": dup_id})
        sp.commit()
        return int(res.rowcount or 0)
    except Exception as exc:  # noqa: BLE001 — table/column may not exist
        sp.rollback()
        msg = str(exc).split("\n", 1)[0]
        print(f"    skip remap: {msg}")
        return 0


def _soft_delete(conn, schema: str, table: str, row_id: UUID, user_id: UUID | None) -> None:
    conn.execute(
        __import__("sqlalchemy").text(
            f"""
            UPDATE {schema}.{table}
            SET is_deleted = true,
                deleted_at = NOW(),
                deleted_by = :uid,
                updated_at = NOW(),
                updated_by = :uid,
                version = COALESCE(version, 1) + 1
            WHERE id = :id AND is_deleted IS NOT TRUE
            """
        ),
        {"id": row_id, "uid": user_id},
    )


def merge_departments(conn, *, dry_run: bool) -> dict:
    from sqlalchemy import text

    rows = conn.execute(
        text(
            """
            SELECT d.id, d.department_name, d.status, d.created_at,
                   (SELECT COUNT(*) FROM master.master_employee e
                    WHERE e.department_id = d.id AND e.is_deleted IS NOT TRUE) AS emp_count
            FROM organization.org_department d
            WHERE d.is_deleted IS NOT TRUE
            ORDER BY d.created_at NULLS LAST
            """
        )
    ).mappings().all()

    groups: dict[str, list] = defaultdict(list)
    for r in rows:
        groups[_norm(r["department_name"])].append(r)

    remapped = 0
    deleted = 0
    kept = 0
    for key, items in groups.items():
        if not key or len(items) < 2:
            continue
        items_sorted = sorted(
            items,
            key=lambda r: (
                0 if str(r["status"] or "").lower() == "active" else 1,
                -int(r["emp_count"] or 0),
                r["created_at"] or __import__("datetime").datetime.max,
            ),
        )
        survivor = items_sorted[0]
        dups = items_sorted[1:]
        kept += 1
        print(
            f"  department '{survivor['department_name']}': keep {survivor['id']} "
            f"(emps={survivor['emp_count']}), drop {len(dups)}"
        )
        if dry_run:
            deleted += len(dups)
            continue
        for dup in dups:
            # Remap FKs that reference org_department
            for sql in (
                "UPDATE master.master_employee SET department_id = :keep WHERE department_id = :dup",
                "UPDATE hr.hr_department_assignment SET department_id = :keep WHERE department_id = :dup",
                "UPDATE organization.org_cost_center SET department_id = :keep WHERE department_id = :dup",
                "UPDATE organization.org_profit_center SET department_id = :keep WHERE department_id = :dup",
                "UPDATE organization.org_department SET parent_department_id = :keep WHERE parent_department_id = :dup",
            ):
                remapped += _safe_remap(conn, sql, survivor["id"], dup["id"])
            _soft_delete(conn, "organization", "org_department", dup["id"], None)
            deleted += 1
    return {"groups_merged": kept, "rows_deleted": deleted, "fk_remapped": remapped}


def merge_locations(conn, *, dry_run: bool) -> dict:
    from sqlalchemy import text

    rows = conn.execute(
        text(
            """
            SELECT id, location_name, status, created_at
            FROM organization.org_location
            WHERE is_deleted IS NOT TRUE
            ORDER BY created_at NULLS LAST
            """
        )
    ).mappings().all()

    groups: dict[str, list] = defaultdict(list)
    for r in rows:
        groups[_norm(r["location_name"])].append(r)

    remapped = 0
    deleted = 0
    kept = 0
    for key, items in groups.items():
        if not key or len(items) < 2:
            continue
        items_sorted = sorted(
            items,
            key=lambda r: (
                0 if str(r["status"] or "").lower() == "active" else 1,
                r["created_at"] or __import__("datetime").datetime.max,
            ),
        )
        survivor = items_sorted[0]
        dups = items_sorted[1:]
        kept += 1
        print(
            f"  location '{survivor['location_name']}': keep {survivor['id']}, drop {len(dups)}"
        )
        if dry_run:
            deleted += len(dups)
            continue
        for dup in dups:
            for sql in (
                "UPDATE master.master_asset SET location_id = :keep WHERE location_id = :dup",
                "UPDATE master.master_warehouse SET location_id = :keep WHERE location_id = :dup",
            ):
                remapped += _safe_remap(conn, sql, survivor["id"], dup["id"])
            _soft_delete(conn, "organization", "org_location", dup["id"], None)
            deleted += 1
    return {"groups_merged": kept, "rows_deleted": deleted, "fk_remapped": remapped}


def merge_designations(conn, *, dry_run: bool) -> dict:
    from sqlalchemy import text

    rows = conn.execute(
        text(
            """
            SELECT d.id, d.designation_name, d.status, d.created_at,
                   (SELECT COUNT(*) FROM hr.hr_designation_assignment a
                    WHERE a.designation_id = d.id AND a.is_deleted IS NOT TRUE) AS ref_count
            FROM hr.hr_designation d
            WHERE d.is_deleted IS NOT TRUE
            ORDER BY d.created_at NULLS LAST
            """
        )
    ).mappings().all()

    groups: dict[str, list] = defaultdict(list)
    for r in rows:
        groups[_norm(r["designation_name"])].append(r)

    remapped = 0
    deleted = 0
    kept = 0
    for key, items in groups.items():
        if not key or len(items) < 2:
            continue
        items_sorted = sorted(
            items,
            key=lambda r: (
                0 if str(r["status"] or "").lower() == "active" else 1,
                -int(r["ref_count"] or 0),
                r["created_at"] or __import__("datetime").datetime.max,
            ),
        )
        survivor = items_sorted[0]
        dups = items_sorted[1:]
        kept += 1
        print(
            f"  designation '{survivor['designation_name']}': keep {survivor['id']} "
            f"(refs={survivor['ref_count']}), drop {len(dups)}"
        )
        if dry_run:
            deleted += len(dups)
            continue
        for dup in dups:
            remapped += _safe_remap(
                conn,
                "UPDATE hr.hr_designation_assignment SET designation_id = :keep "
                "WHERE designation_id = :dup",
                survivor["id"],
                dup["id"],
            )
            _soft_delete(conn, "hr", "hr_designation", dup["id"], None)
            deleted += 1
    return {"groups_merged": kept, "rows_deleted": deleted, "fk_remapped": remapped}


def main() -> int:
    parser = argparse.ArgumentParser(description="Merge shared org master duplicates")
    parser.add_argument("--dry-run", action="store_true")
    args = parser.parse_args()

    from database.session import SessionLocal

    db = SessionLocal()
    try:
        conn = db.connection()
        print("Merging departments…")
        dept = merge_departments(conn, dry_run=args.dry_run)
        print("Merging base locations…")
        loc = merge_locations(conn, dry_run=args.dry_run)
        print("Merging designations…")
        desig = merge_designations(conn, dry_run=args.dry_run)
        if args.dry_run:
            db.rollback()
            print("Dry run — no changes committed.")
        else:
            db.commit()
            print("Committed.")
        print({"departments": dept, "locations": loc, "designations": desig})
        return 0
    except Exception as exc:
        db.rollback()
        print(f"ERROR: {exc}", flush=True)
        return 1
    finally:
        db.close()


if __name__ == "__main__":
    raise SystemExit(main())
