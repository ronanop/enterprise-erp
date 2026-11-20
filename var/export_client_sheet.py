"""Export Client sheet into Digitech + Technologies client_side CSVs."""
from __future__ import annotations

import csv
import os
from collections import Counter
from datetime import date, datetime

import openpyxl

SRC = r"c:\Users\anil2\Downloads\Employee Data (HRMS) (1).xlsx"
OUT_DIR = r"d:\erp-main\enterprise-erp\var"

OUT_HEADERS = [
    "Sr. No.",
    "Status",
    "Tag",
    "EMPLOYEE ID",
    "New E codes",
    "NAME",
    "Entity",
    "Deployed At",
    "Base Location",
    "Designation",
    "Department",
    "Reporting Manager",
    "DOJ",
    "Emp. Contact No.",
    "Email id",
    "Gender",
    "DOB",
]


def cell(v: object) -> str:
    if v is None:
        return ""
    if isinstance(v, datetime):
        return v.strftime("%Y-%m-%d")
    if isinstance(v, date):
        return v.strftime("%Y-%m-%d")
    s = str(v).strip().strip("'")
    if s.lower() in ("na", "n/a", "#n/a", "none", "null"):
        return ""
    return s


def entity_bucket(raw: str) -> str:
    t = raw.strip().lower()
    if "technolog" in t:
        return "technologies"
    if "digitech" in t:
        return "digitech"
    return "other"


def main() -> None:
    os.makedirs(OUT_DIR, exist_ok=True)
    wb = openpyxl.load_workbook(SRC, data_only=True)
    ws = wb["Client"]
    rows = list(ws.iter_rows(values_only=True))
    header = [str(c).strip() if c is not None else "" for c in rows[0]]
    idx = {h: i for i, h in enumerate(header)}

    buckets: dict[str, list[list[str]]] = {
        "digitech": [],
        "technologies": [],
        "other": [],
    }

    for r in rows[1:]:
        vals = list(r)
        if not any(v is not None and str(v).strip() for v in vals):
            continue

        def g(name: str) -> str:
            i = idx.get(name)
            return cell(vals[i]) if i is not None and i < len(vals) else ""

        name = g("NAME")
        code = g("New E codes") or g("EMPLOYEE ID")
        if not name or not code:
            continue
        entity = g("Entity")
        row = [
            g("Sr. No."),
            g("Status") or "Active",
            g("Tag") or "client_side",
            g("EMPLOYEE ID"),
            g("New E codes"),
            name,
            entity,
            g("Deployed At"),
            g("Base Location"),
            g("Designation"),
            g("Department"),
            g("Reporting Manager"),
            g("DOJ"),
            g("Emp.Contact No.") or g("Emp. Contact No."),
            g("Email id"),
            g("Gender"),
            g("DOB"),
        ]
        buckets[entity_bucket(entity)].append(row)

    files = {
        "digitech": os.path.join(OUT_DIR, "client-side-digitech.csv"),
        "technologies": os.path.join(OUT_DIR, "client-side-technologies.csv"),
        "other": os.path.join(OUT_DIR, "client-side-other.csv"),
    }
    for key, path in files.items():
        rows_out = buckets[key]
        if not rows_out:
            continue
        with open(path, "w", newline="", encoding="utf-8") as f:
            w = csv.writer(f)
            w.writerow(OUT_HEADERS)
            w.writerows(rows_out)
        print(f"{key}: {len(rows_out)} -> {path}")

    print("deployed:", Counter(r[7] for rows_out in buckets.values() for r in rows_out))
    wb.close()


if __name__ == "__main__":
    main()
