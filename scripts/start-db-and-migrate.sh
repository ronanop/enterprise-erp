#!/usr/bin/env bash
# Start ERP Postgres (Docker :5433) and apply Alembic migrations.
# Run from anywhere; intended for your local Terminal (not the Cursor sandbox).
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT"

if ! docker info >/dev/null 2>&1; then
  echo "Docker engine is not running."
  echo "1) Open Docker Desktop from Applications and wait until it says Running."
  echo "2) Re-run: bash scripts/start-db-and-migrate.sh"
  exit 1
fi

echo "Starting postgres container..."
docker compose up -d postgres

echo "Waiting for postgres on localhost:5433..."
for i in $(seq 1 30); do
  if docker exec erp-postgres pg_isready -U erp -d erp >/dev/null 2>&1; then
    echo "Postgres is ready."
    break
  fi
  if [[ "$i" -eq 30 ]]; then
    echo "Timed out waiting for erp-postgres."
    docker compose ps
    exit 1
  fi
  sleep 1
done

echo "Running alembic upgrade head..."
cd "$ROOT/apps/api"
.venv/bin/alembic upgrade head
.venv/bin/alembic current
echo "Done."
