"""Copy master_employee (+ linked sec_user) rows referenced by service data."""

from __future__ import annotations

from typing import Any
from uuid import UUID

import psycopg
from psycopg import sql
from psycopg.types.json import Jsonb

LOCAL = "host=localhost port=5433 dbname=erp user=erp password=erp_dev_password"
VM = "host=172.16.200.26 port=5432 dbname=erp user=erp-postgres password=erp-postgres"


def adapt(v: Any) -> Any:
    if isinstance(v, (dict, list)):
        return Jsonb(v)
    return v


def cols(conn: psycopg.Connection, schema: str, table: str) -> list[str]:
    with conn.cursor() as cur:
        cur.execute(
            """
            SELECT column_name
            FROM information_schema.columns
            WHERE table_schema = %s AND table_name = %s
            ORDER BY ordinal_position
            """,
            (schema, table),
        )
        return [r[0] for r in cur.fetchall()]


def missing_employee_ids(vm: psycopg.Connection) -> list[UUID]:
    with vm.cursor() as cur:
        cur.execute(
            """
            SELECT DISTINCT x.emp_id
            FROM (
              SELECT owner_employee_id AS emp_id
              FROM service.svc_service_request
              WHERE owner_employee_id IS NOT NULL
              UNION
              SELECT co_owner_employee_id
              FROM service.svc_service_request
              WHERE co_owner_employee_id IS NOT NULL
              UNION
              SELECT reported_by_employee_id
              FROM service.svc_service_request
              WHERE reported_by_employee_id IS NOT NULL
            ) x
            LEFT JOIN master.master_employee e ON e.id = x.emp_id
            WHERE e.id IS NULL
            """
        )
        # discover actual columns first if this fails
        return [r[0] for r in cur.fetchall()]


def main() -> None:
    with psycopg.connect(LOCAL) as loc, psycopg.connect(VM) as vm:
        with loc.cursor() as cur:
            cur.execute(
                """
                SELECT column_name FROM information_schema.columns
                WHERE table_schema='service' AND table_name='svc_service_request'
                  AND column_name ILIKE '%employee%'
                ORDER BY 1
                """
            )
            emp_cols = [r[0] for r in cur.fetchall()]
            print("service request employee cols:", emp_cols)

            parts = [
                f"SELECT {c} AS emp_id FROM service.svc_service_request WHERE {c} IS NOT NULL"
                for c in emp_cols
            ]
            # field engineer table may store emails not employee ids
            cur.execute(
                """
                SELECT column_name FROM information_schema.columns
                WHERE table_schema='service' AND table_name='svc_ticket_field_engineer'
                ORDER BY ordinal_position
                """
            )
            fe_cols = [r[0] for r in cur.fetchall()]
            print("field engineer cols:", fe_cols)
            if "employee_id" in fe_cols:
                parts.append(
                    "SELECT employee_id AS emp_id FROM service.svc_ticket_field_engineer "
                    "WHERE employee_id IS NOT NULL"
                )

            cur.execute(" UNION ".join(parts))
            needed = {r[0] for r in cur.fetchall()}
            print(f"Referenced employee ids: {len(needed)}")

        with vm.cursor() as cur:
            cur.execute(
                "SELECT id FROM master.master_employee WHERE id = ANY(%s)",
                (list(needed),),
            )
            present = {r[0] for r in cur.fetchall()}
        missing = sorted(needed - present)
        print(f"Missing on VM: {len(missing)}")
        if not missing:
            print("Nothing to copy.")
            return

        emp_cols = cols(loc, "master", "master_employee")
        vm_emp_cols = set(cols(vm, "master", "master_employee"))
        use_cols = [c for c in emp_cols if c in vm_emp_cols]
        print(f"Copying {len(missing)} employees with {len(use_cols)} columns…")

        with loc.cursor() as cur:
            cur.execute(
                sql.SQL("SELECT {} FROM master.master_employee WHERE id = ANY(%s)").format(
                    sql.SQL(", ").join(sql.Identifier(c) for c in use_cols)
                ),
                (missing,),
            )
            rows = [tuple(adapt(v) for v in row) for row in cur.fetchall()]

        with vm.cursor() as cur:
            cur.execute("SET session_replication_role = replica")
            q = sql.SQL("INSERT INTO master.master_employee ({}) VALUES ({}) ON CONFLICT (id) DO NOTHING").format(
                sql.SQL(", ").join(sql.Identifier(c) for c in use_cols),
                sql.SQL(", ").join(sql.Placeholder() * len(use_cols)),
            )
            cur.executemany(q, rows)
            cur.execute("SET session_replication_role = DEFAULT")
        vm.commit()
        print(f"Inserted {len(rows)} master_employee rows.")

        # Re-check orphans
        with vm.cursor() as cur:
            col_list = ", ".join(emp_cols)
            unions = " UNION ".join(
                f"SELECT {c} AS emp_id FROM service.svc_service_request WHERE {c} IS NOT NULL"
                for c in emp_cols
            )
            cur.execute(
                f"""
                SELECT COUNT(*) FROM ({unions}) x
                LEFT JOIN master.master_employee e ON e.id = x.emp_id
                WHERE e.id IS NULL
                """
            )
            print("Remaining missing owners:", cur.fetchone()[0])


if __name__ == "__main__":
    main()
