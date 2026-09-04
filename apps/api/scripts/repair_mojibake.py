"""Safely discover and repair legacy UTF-8 mojibake in ERP database data.

Run from ``apps/api``:
    python -m scripts.repair_mojibake --dry-run
    python -m scripts.repair_mojibake --apply

The script scans live PostgreSQL catalog columns, skips append-only audit tables,
and only writes a value when decoding is unambiguously cleaner than the source.
"""

from __future__ import annotations

import argparse
import json
from collections.abc import Iterable
from pathlib import Path
from uuid import UUID

from sqlalchemy import text
from sqlalchemy.orm import Session

from database.session import SessionLocal
from modules.foundation.service.audit_service import AuditService

MARKERS = ("ΓÇ", "â€", "Ã", "Â", "\ufffd")
SKIP_SCHEMAS = {"pg_catalog", "information_schema", "audit"}


def marker_score(value: str) -> int:
    return sum(value.count(marker) for marker in MARKERS)


def repair_text(value: str) -> str:
    """Return an improved decode only when the evidence is unambiguous."""
    if not any(marker in value for marker in MARKERS):
        return value
    original_score = marker_score(value)
    best = value
    best_score = original_score
    for encoding in ("cp437", "cp1252", "latin-1"):
        try:
            candidate = value.encode(encoding).decode("utf-8")
        except (UnicodeDecodeError, UnicodeEncodeError):
            continue
        score = marker_score(candidate)
        if "\ufffd" not in candidate and score < best_score:
            best = candidate
            best_score = score
    return best


def repair_json(value: object) -> object:
    if isinstance(value, str):
        return repair_text(value)
    if isinstance(value, list):
        return [repair_json(item) for item in value]
    if isinstance(value, dict):
        return {key: repair_json(item) for key, item in value.items()}
    return value


def quote(identifier: str) -> str:
    return f'"{identifier.replace(chr(34), chr(34) * 2)}"'


def columns(db: Session) -> list[dict]:
    result = db.execute(
        text(
            """
            SELECT n.nspname AS schema_name, c.relname AS table_name,
                   a.attname AS column_name, t.typname AS type_name,
                   COALESCE(array_agg(pk.attname ORDER BY pkx.ordinality)
                     FILTER (WHERE pk.attname IS NOT NULL), '{}') AS primary_keys
              FROM pg_catalog.pg_attribute a
              JOIN pg_catalog.pg_class c ON c.oid = a.attrelid
              JOIN pg_catalog.pg_namespace n ON n.oid = c.relnamespace
              JOIN pg_catalog.pg_type t ON t.oid = a.atttypid
              LEFT JOIN pg_catalog.pg_index idx ON idx.indrelid = c.oid AND idx.indisprimary
              LEFT JOIN LATERAL unnest(idx.indkey) WITH ORDINALITY pkx(attnum, ordinality) ON TRUE
              LEFT JOIN pg_catalog.pg_attribute pk ON pk.attrelid = c.oid AND pk.attnum = pkx.attnum
             WHERE c.relkind IN ('r', 'p')
               AND a.attnum > 0 AND NOT a.attisdropped
               AND n.nspname NOT IN ('pg_catalog', 'information_schema', 'audit')
               AND t.typname IN ('text', 'varchar', 'bpchar', 'json', 'jsonb')
             GROUP BY n.nspname, c.relname, a.attname, t.typname, a.attnum
             ORDER BY n.nspname, c.relname, a.attnum
            """
        )
    ).mappings()
    return [dict(row) for row in result if row["schema_name"] not in SKIP_SCHEMAS and row["primary_keys"]]


def candidate_rows(db: Session, spec: dict) -> Iterable[dict]:
    schema, table, column = (spec["schema_name"], spec["table_name"], spec["column_name"])
    keys = list(spec["primary_keys"])
    has_tenant_id = db.scalar(
        text(
            """
            SELECT EXISTS (
              SELECT 1 FROM information_schema.columns
               WHERE table_schema = :schema AND table_name = :table
                 AND column_name = 'tenant_id'
            )
            """
        ),
        {"schema": schema, "table": table},
    )
    selected = [quote(key) for key in keys]
    if has_tenant_id and "tenant_id" not in keys:
        selected.append('"tenant_id"')
    key_sql = ", ".join(selected)
    sql = text(
        f"SELECT {key_sql}, {quote(column)} AS value"
        f" FROM {quote(schema)}.{quote(table)}"
        f" WHERE CAST({quote(column)} AS text) ~ :marker"
    )
    return db.execute(sql, {"marker": "ΓÇ|â€|Ã|Â|\ufffd"}).mappings()


def changed_value(value: object, type_name: str) -> object:
    if type_name in {"json", "jsonb"}:
        return repair_json(value)
    return repair_text(str(value))


def manifest_row(spec: dict, row: dict, before: object, after: object) -> dict:
    return {
        "schema": spec["schema_name"],
        "table": spec["table_name"],
        "column": spec["column_name"],
        "primary_key": {key: str(row[key]) for key in spec["primary_keys"]},
        "before": before,
        "after": after,
    }


def apply_change(db: Session, spec: dict, row: dict, after: object) -> None:
    schema, table, column = (spec["schema_name"], spec["table_name"], spec["column_name"])
    keys = list(spec["primary_keys"])
    predicates = " AND ".join(f"{quote(key)} = :{key}" for key in keys)
    value_sql = f"CAST(:value AS {spec['type_name']})" if spec["type_name"] in {"json", "jsonb"} else ":value"
    db.execute(
        text(
            f"UPDATE {quote(schema)}.{quote(table)} SET {quote(column)} = {value_sql}"
            f" WHERE {predicates}"
        ),
        {**{key: row[key] for key in keys}, "value": json.dumps(after) if spec["type_name"] in {"json", "jsonb"} else after},
    )


def audit_change(db: Session, spec: dict, row: dict, before: object, after: object) -> None:
    if "id" not in spec["primary_keys"] or "tenant_id" not in row:
        return
    try:
        AuditService(db).log_entity_change(
            tenant_id=UUID(str(row["tenant_id"])) if row["tenant_id"] else None,
            entity_name=f"{spec['schema_name']}.{spec['table_name']}",
            entity_id=UUID(str(row["id"])),
            operation="encoding_repair",
            performed_by=None,
            old_value={spec["column_name"]: before},
            new_value={spec["column_name"]: after},
        )
    except (ValueError, TypeError):
        return


def run(apply: bool, manifest_path: Path) -> tuple[int, int]:
    db = SessionLocal()
    changed = scanned = 0
    try:
        with manifest_path.open("w", encoding="utf-8") as manifest:
            for spec in columns(db):
                for row in candidate_rows(db, spec):
                    scanned += 1
                    before = row["value"]
                    after = changed_value(before, spec["type_name"])
                    if after == before:
                        continue
                    record = manifest_row(spec, row, before, after)
                    manifest.write(json.dumps(record, ensure_ascii=False, default=str) + "\n")
                    changed += 1
                    if apply:
                        apply_change(db, spec, row, after)
                        audit_change(db, spec, row, before, after)
        if apply:
            db.commit()
        else:
            db.rollback()
    except Exception:
        db.rollback()
        raise
    finally:
        db.close()
    return scanned, changed


def main() -> None:
    parser = argparse.ArgumentParser()
    mode = parser.add_mutually_exclusive_group(required=True)
    mode.add_argument("--dry-run", action="store_true")
    mode.add_argument("--apply", action="store_true")
    parser.add_argument(
        "--manifest",
        type=Path,
        default=Path("var") / "mojibake-repair-manifest.jsonl",
    )
    args = parser.parse_args()
    args.manifest.parent.mkdir(parents=True, exist_ok=True)
    scanned, changed = run(args.apply, args.manifest)
    print(f"mode={'apply' if args.apply else 'dry-run'} scanned={scanned} changed={changed}")
    print(f"manifest={args.manifest.resolve()}")


if __name__ == "__main__":
    main()
