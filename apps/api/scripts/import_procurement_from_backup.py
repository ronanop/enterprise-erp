#!/usr/bin/env python3
"""Import procurement transactional data from a full ERP SQL backup.

Safe scope: procurement + minimal master rows (SCM-PURCHASED product, missing vendors).
Does NOT import CRM, projects, or sec_user rows.
"""

from __future__ import annotations

import argparse
import re
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[1] / "src"))

from sqlalchemy import create_engine, text
from core.config import settings

BACKUP_DEFAULT = Path(r"C:\Users\Moksh sharma\Downloads\erp_full_backup_20260811_115330.sql")

SCM_PRODUCT_ID = "890c9193-3e65-4d4f-8898-ecd2e2205478"
EXTRA_VENDOR_IDS = {
    "2e8d6ea8-9728-486b-8d86-cf7ecf8549ac",
    "24c579b5-70fe-4a79-8845-2a68546a4ffa",
    "92587f68-73d0-47fb-a35c-411a3ce71041",
    "fbec6256-0063-4850-af96-8b6a55f70c27",
}

PROCUREMENT_TABLE_ORDER = [
    "procurement.proc_order_header",
    "procurement.proc_order_line",
    "procurement.proc_order_receipt_batch",
    "procurement.proc_order_receipt_batch_line",
    "procurement.proc_inventory_import_line",
    "procurement.proc_inventory_stock_unit",
    "procurement.proc_grn_header",
    "procurement.proc_grn_line",
    "procurement.proc_invoice_header",
    "procurement.proc_invoice_line",
]

INSERT_RE = re.compile(r"^INSERT INTO ([a-z_]+\.[a-z_]+) VALUES ", re.IGNORECASE)


def load_inserts(backup_path: Path) -> dict[str, list[str]]:
    grouped: dict[str, list[str]] = {}
    # A backup must be valid UTF-8. Replacing undecodable bytes would persist
    # corrupt text into the target ERP database.
    for line in backup_path.read_text(encoding="utf-8", errors="strict").splitlines():
        m = INSERT_RE.match(line.strip())
        if not m:
            continue
        table = m.group(1).lower()
        grouped.setdefault(table, []).append(line.strip().rstrip(";"))
    return grouped


def pick_master_inserts(grouped: dict[str, list[str]]) -> list[str]:
    out: list[str] = []
    product_ids: set[str] = {SCM_PRODUCT_ID}
    for stmt in grouped.get("procurement.proc_order_line", []):
        m = re.search(
            r"VALUES \('[^']+', '[^']+', \d+, '([0-9a-f-]{36})'",
            stmt,
            re.IGNORECASE,
        )
        if m:
            product_ids.add(m.group(1))

    for stmt in grouped.get("master.master_product", []):
        if any(pid in stmt for pid in product_ids):
            out.append(stmt)
    for stmt in grouped.get("master.master_vendor", []):
        if any(vid in stmt for vid in EXTRA_VENDOR_IDS):
            out.append(stmt)
    return out


def pick_procurement_inserts(grouped: dict[str, list[str]]) -> list[str]:
    out: list[str] = []
    for table in PROCUREMENT_TABLE_ORDER:
        out.extend(grouped.get(table, []))
    return out


def with_conflict(stmt: str, table: str) -> str:
    return stmt + " ON CONFLICT (id) DO NOTHING"


def run_import(backup_path: Path, dry_run: bool = False) -> None:
    grouped = load_inserts(backup_path)
    master_stmts = pick_master_inserts(grouped)
    proc_stmts: list[tuple[str, str]] = []
    for table in PROCUREMENT_TABLE_ORDER:
        for stmt in grouped.get(table, []):
            proc_stmts.append((table, with_conflict(stmt, table)))

    print(f"Backup: {backup_path}")
    print(f"Master rows to apply: {len(master_stmts)}")
    print(f"Procurement rows to apply: {len(proc_stmts)}")

    if dry_run:
        for stmt in master_stmts:
            print(stmt[:120] + "...")
        for table, stmt in proc_stmts[:5]:
            print(f"[{table}] {stmt[:100]}...")
        return

    engine = create_engine(settings.database_url)
    with engine.begin() as conn:
        for stmt in master_stmts:
            conn.execute(text(stmt))
        for table, stmt in proc_stmts:
            try:
                conn.execute(text(stmt))
            except Exception as exc:
                print(f"FAILED [{table}]: {exc}")
                print(stmt[:200] + "...")
                raise

    with engine.connect() as conn:
        po_count = conn.execute(
            text(
                "select count(*) from procurement.proc_order_header "
                "where is_deleted is not true"
            )
        ).scalar()
        line_count = conn.execute(
            text("select count(*) from procurement.proc_order_line where is_deleted is not true")
        ).scalar()
        batch_count = conn.execute(
            text(
                "select count(*) from procurement.proc_order_receipt_batch "
                "where is_deleted is not true"
            )
        ).scalar()
        stock_count = conn.execute(
            text(
                "select count(*) from procurement.proc_inventory_stock_unit "
                "where is_deleted is not true"
            )
        ).scalar()
    print(
        f"Import complete. POs={po_count}, lines={line_count}, "
        f"receipt_batches={batch_count}, stock_units={stock_count}"
    )


def main() -> None:
    parser = argparse.ArgumentParser(description="Import procurement data from ERP backup SQL")
    parser.add_argument("--backup", type=Path, default=BACKUP_DEFAULT)
    parser.add_argument("--dry-run", action="store_true")
    args = parser.parse_args()
    if not args.backup.exists():
        raise SystemExit(f"Backup not found: {args.backup}")
    run_import(args.backup, dry_run=args.dry_run)


if __name__ == "__main__":
    main()
