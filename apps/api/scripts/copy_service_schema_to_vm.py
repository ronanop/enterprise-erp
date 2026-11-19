"""Copy service.* table data from local Postgres to VM Postgres.

Usage (from apps/api):
  .venv\\Scripts\\python.exe scripts/copy_service_schema_to_vm.py
  .venv\\Scripts\\python.exe scripts/copy_service_schema_to_vm.py --dry-run
"""

from __future__ import annotations

import argparse
import sys
from collections import defaultdict, deque
from typing import Any

import psycopg
from psycopg import sql
from psycopg.types.json import Jsonb

LOCAL_DSN = "host=localhost port=5433 dbname=erp user=erp password=erp_dev_password"
VM_DSN = "host=172.16.200.26 port=5432 dbname=erp user=erp-postgres password=erp-postgres"
SCHEMA = "service"


def list_tables(conn: psycopg.Connection) -> list[str]:
    with conn.cursor() as cur:
        cur.execute(
            """
            SELECT c.relname
            FROM pg_class c
            JOIN pg_namespace n ON n.oid = c.relnamespace
            WHERE n.nspname = %s AND c.relkind = 'r'
            ORDER BY 1
            """,
            (SCHEMA,),
        )
        return [row[0] for row in cur.fetchall()]


def table_counts(conn: psycopg.Connection, tables: list[str]) -> dict[str, int]:
    out: dict[str, int] = {}
    with conn.cursor() as cur:
        for table in tables:
            cur.execute(
                sql.SQL("SELECT COUNT(*) FROM {}.{}").format(
                    sql.Identifier(SCHEMA),
                    sql.Identifier(table),
                )
            )
            out[table] = int(cur.fetchone()[0])
    return out


def fk_edges(conn: psycopg.Connection, tables: set[str]) -> list[tuple[str, str]]:
    """Return (child, parent) edges for FKs entirely inside service schema."""
    with conn.cursor() as cur:
        cur.execute(
            """
            SELECT
                child.relname AS child_table,
                parent.relname AS parent_table
            FROM pg_constraint con
            JOIN pg_class child ON child.oid = con.conrelid
            JOIN pg_namespace cn ON cn.oid = child.relnamespace
            JOIN pg_class parent ON parent.oid = con.confrelid
            JOIN pg_namespace pn ON pn.oid = parent.relnamespace
            WHERE con.contype = 'f'
              AND cn.nspname = %s
              AND pn.nspname = %s
            """,
            (SCHEMA, SCHEMA),
        )
        edges: list[tuple[str, str]] = []
        for child, parent in cur.fetchall():
            if child in tables and parent in tables and child != parent:
                edges.append((child, parent))
        return edges


def topo_order(tables: list[str], edges: list[tuple[str, str]]) -> list[str]:
    """Parents before children for insert order."""
    table_set = set(tables)
    indegree = {t: 0 for t in tables}
    children: dict[str, list[str]] = defaultdict(list)
    for child, parent in edges:
        # edge means child depends on parent → parent first
        children[parent].append(child)
        indegree[child] += 1

    queue = deque(sorted(t for t, d in indegree.items() if d == 0))
    ordered: list[str] = []
    while queue:
        node = queue.popleft()
        ordered.append(node)
        for child in sorted(children[node]):
            indegree[child] -= 1
            if indegree[child] == 0:
                queue.append(child)

    missing = [t for t in tables if t not in ordered]
    if missing:
        # cycles / unresolved — append remaining alphabetically
        ordered.extend(sorted(missing))
    # keep only known tables, preserve order
    return [t for t in ordered if t in table_set]


def column_names(conn: psycopg.Connection, table: str) -> list[str]:
    with conn.cursor() as cur:
        cur.execute(
            """
            SELECT a.attname
            FROM pg_attribute a
            JOIN pg_class c ON c.oid = a.attrelid
            JOIN pg_namespace n ON n.oid = c.relnamespace
            WHERE n.nspname = %s
              AND c.relname = %s
              AND a.attnum > 0
              AND NOT a.attisdropped
            ORDER BY a.attnum
            """,
            (SCHEMA, table),
        )
        return [row[0] for row in cur.fetchall()]


def fetch_rows(conn: psycopg.Connection, table: str, cols: list[str]) -> list[tuple]:
    col_sql = sql.SQL(", ").join(sql.Identifier(c) for c in cols)
    query = sql.SQL("SELECT {} FROM {}.{}").format(
        col_sql,
        sql.Identifier(SCHEMA),
        sql.Identifier(table),
    )
    with conn.cursor() as cur:
        cur.execute(query)
        return list(cur.fetchall())


def truncate_tables(conn: psycopg.Connection, tables: list[str]) -> None:
    if not tables:
        return
    # reverse insert order for safer truncate; CASCADE clears dependents
    stmt = sql.SQL("TRUNCATE TABLE {} RESTART IDENTITY CASCADE").format(
        sql.SQL(", ").join(
            sql.SQL("{}.{}").format(sql.Identifier(SCHEMA), sql.Identifier(t)) for t in tables
        )
    )
    with conn.cursor() as cur:
        cur.execute(stmt)


def _adapt_value(value: Any) -> Any:
    if isinstance(value, (dict, list)):
        return Jsonb(value)
    return value


def _adapt_row(row: tuple) -> tuple:
    return tuple(_adapt_value(v) for v in row)


def insert_rows(
    conn: psycopg.Connection,
    table: str,
    cols: list[str],
    rows: list[tuple],
) -> int:
    if not rows:
        return 0
    col_sql = sql.SQL(", ").join(sql.Identifier(c) for c in cols)
    placeholders = sql.SQL(", ").join(sql.Placeholder() * len(cols))
    query = sql.SQL("INSERT INTO {}.{} ({}) VALUES ({})").format(
        sql.Identifier(SCHEMA),
        sql.Identifier(table),
        col_sql,
        placeholders,
    )
    adapted = [_adapt_row(row) for row in rows]
    with conn.cursor() as cur:
        cur.executemany(query, adapted)
    return len(rows)


def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--dry-run", action="store_true", help="Compare only; do not write")
    parser.add_argument("--local-dsn", default=LOCAL_DSN)
    parser.add_argument("--vm-dsn", default=VM_DSN)
    args = parser.parse_args()

    print("Connecting…")
    with psycopg.connect(args.local_dsn) as local_conn, psycopg.connect(args.vm_dsn) as vm_conn:
        local_tables = list_tables(local_conn)
        vm_tables = list_tables(vm_conn)
        common = sorted(set(local_tables) & set(vm_tables))
        only_local = sorted(set(local_tables) - set(vm_tables))
        only_vm = sorted(set(vm_tables) - set(local_tables))

        print(f"Local service tables: {len(local_tables)}")
        print(f"VM service tables:    {len(vm_tables)}")
        if only_local:
            print(f"WARNING only on local (skipped): {only_local}")
        if only_vm:
            print(f"NOTE only on VM (unchanged): {only_vm}")

        local_counts = table_counts(local_conn, common)
        vm_counts = table_counts(vm_conn, common)
        print("\nTable                              local      vm")
        print("-" * 52)
        for table in common:
            print(f"{table:<32} {local_counts[table]:>7} {vm_counts[table]:>7}")
        print("-" * 52)
        print(
            f"{'TOTAL':<32} {sum(local_counts.values()):>7} {sum(vm_counts.values()):>7}"
        )

        if args.dry_run:
            print("\nDry run only — no data copied.")
            return 0

        edges = fk_edges(local_conn, set(common))
        order = topo_order(common, edges)
        print(f"\nInsert order ({len(order)} tables): {', '.join(order)}")

        # Load with FK checks off so refs to master/org/foundation UUIDs
        # that differ between environments do not block the copy.
        with vm_conn.cursor() as cur:
            cur.execute("SET session_replication_role = replica")
        print("Truncating VM service tables…")
        truncate_tables(vm_conn, list(reversed(order)))
        vm_conn.commit()

        copied = 0
        for table in order:
            cols = column_names(local_conn, table)
            # Intersection of columns in case schemas drift slightly
            vm_cols = set(column_names(vm_conn, table))
            use_cols = [c for c in cols if c in vm_cols]
            skipped_cols = [c for c in cols if c not in vm_cols]
            if skipped_cols:
                print(f"  {table}: skipping columns missing on VM: {skipped_cols}")
            rows = fetch_rows(local_conn, table, use_cols)
            n = insert_rows(vm_conn, table, use_cols, rows)
            copied += n
            print(f"  {table}: copied {n} rows")
            vm_conn.commit()

        with vm_conn.cursor() as cur:
            cur.execute("SET session_replication_role = DEFAULT")
        vm_conn.commit()

        after = table_counts(vm_conn, common)
        print("\nAfter copy:")
        print("Table                              local      vm")
        print("-" * 52)
        for table in common:
            print(f"{table:<32} {local_counts[table]:>7} {after[table]:>7}")
        print("-" * 52)
        print(f"{'TOTAL':<32} {sum(local_counts.values()):>7} {sum(after.values()):>7}")
        print(f"\nDone. Copied {copied} rows into VM service schema.")
        print(
            "Note: service rows may reference local master/org UUIDs; "
            "if those IDs are missing on the VM, some ticket lookups may show blanks."
        )
    return 0


if __name__ == "__main__":
    try:
        raise SystemExit(main())
    except Exception as exc:  # noqa: BLE001
        print(f"ERROR: {exc}", file=sys.stderr)
        raise
