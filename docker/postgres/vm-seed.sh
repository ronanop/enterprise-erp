#!/bin/sh
# One-shot DB seed for VM stack. Restores backups into empty databases only.
set -eu

PGHOST="${PGHOST:-postgres}"
PGPORT="${PGPORT:-5432}"
PGUSER="${POSTGRES_USER:-erp-postgres}"
export PGPASSWORD="${POSTGRES_PASSWORD:-erp-postgres}"

PRIMARY_DB="${POSTGRES_DB:-erp_hrms}"
PRIMARY_DUMP="${PRIMARY_DUMP:-/backups/vm-seed-erp_hrms.dump}"
SECONDARY_DB="${SECONDARY_DB:-erp}"
SECONDARY_DUMP="${SECONDARY_DUMP:-/backups/vm-seed-erp.dump}"
MARKER_DIR="${MARKER_DIR:-/var/lib/postgresql/seed-markers}"

mkdir -p "$MARKER_DIR"

echo "vm-seed: waiting for postgres at ${PGHOST}:${PGPORT}…"
i=0
until pg_isready -h "$PGHOST" -p "$PGPORT" -U "$PGUSER" >/dev/null 2>&1; do
  i=$((i + 1))
  if [ "$i" -gt 60 ]; then
    echo "vm-seed: postgres not ready" >&2
    exit 1
  fi
  sleep 2
done

ensure_db() {
  db="$1"
  exists="$(
    psql -h "$PGHOST" -p "$PGPORT" -U "$PGUSER" -d postgres -At \
      -c "SELECT 1 FROM pg_database WHERE datname='${db}'" || true
  )"
  if [ "$exists" != "1" ]; then
    echo "vm-seed: creating database ${db}…"
    psql -h "$PGHOST" -p "$PGPORT" -U "$PGUSER" -d postgres -v ON_ERROR_STOP=1 \
      -c "CREATE DATABASE \"${db}\" OWNER \"${PGUSER}\";"
  fi
}

employee_count() {
  db="$1"
  psql -h "$PGHOST" -p "$PGPORT" -U "$PGUSER" -d "$db" -At \
    -c "SELECT count(*) FROM master.master_employee" 2>/dev/null || echo 0
}

restore_db() {
  db="$1"
  dump="$2"
  marker="${MARKER_DIR}/${db}.seeded"

  if [ -f "$marker" ]; then
    echo "vm-seed: skip ${db} (already seeded)"
    return 0
  fi

  if [ ! -f "$dump" ]; then
    echo "vm-seed: dump missing for ${db}: ${dump} (skip)" >&2
    return 0
  fi

  ensure_db "$db"

  emp_count="$(employee_count "$db")"
  if [ "${emp_count:-0}" -gt 0 ]; then
    echo "vm-seed: ${db} already has ${emp_count} employees — marking seeded, skip restore"
    touch "$marker"
    return 0
  fi

  echo "vm-seed: restoring ${dump} → ${db}…"
  # Schema objects may already exist from POSTGRES_DB init; tolerate clean errors.
  pg_restore -h "$PGHOST" -p "$PGPORT" -U "$PGUSER" -d "$db" \
    --no-owner --no-acl --clean --if-exists \
    "$dump" || true

  emp_after="$(employee_count "$db")"
  echo "vm-seed: ${db} employees after restore = ${emp_after}"
  touch "$marker"
}

restore_db "$PRIMARY_DB" "$PRIMARY_DUMP"
restore_db "$SECONDARY_DB" "$SECONDARY_DUMP"

echo "vm-seed: done"
