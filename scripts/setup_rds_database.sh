#!/usr/bin/env bash
# Connect to DATABASE_URL from .env, optionally restore full SQL backup, verify schemas.
# Usage:
#   ./scripts/setup_rds_database.sh              # migrate only (Alembic via API image)
#   ./scripts/setup_rds_database.sh --restore     # restore backups/erp_full_backup_latest.sql then migrate
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT"

if [[ ! -f .env ]]; then
  echo "Missing .env" >&2
  exit 1
fi

# shellcheck disable=SC1091
set -a
# Load only DB-related keys without sourcing whole .env (avoids bash parsing issues)
eval "$(
  python3 - <<'PY'
import re
from pathlib import Path
env = Path(".env").read_text()
keys = [
    "DATABASE_URL",
    "POSTGRES_HOST",
    "POSTGRES_PORT",
    "POSTGRES_USER",
    "POSTGRES_PASSWORD",
    "POSTGRES_DB",
]
for k in keys:
    m = re.search(rf"^{re.escape(k)}=(.*)$", env, re.M)
    if not m:
        continue
    v = m.group(1).strip().strip('"').strip("'")
    print(f"export {k}={v!r}")
PY
)"
set +a

RESTORE=0
if [[ "${1:-}" == "--restore" ]]; then
  RESTORE=1
fi

HOST="${POSTGRES_HOST:?}"
PORT="${POSTGRES_PORT:-5432}"
USER="${POSTGRES_USER:?}"
DB="${POSTGRES_DB:?}"
export PGPASSWORD="${POSTGRES_PASSWORD:?}"

echo "Target: ${USER}@${HOST}:${PORT}/${DB}"

echo "Probing TCP ${HOST}:${PORT} ..."
python3 - <<PY
import os, socket, sys
host = os.environ["POSTGRES_HOST"]
port = int(os.environ.get("POSTGRES_PORT") or "5432")
s = socket.socket()
s.settimeout(10)
try:
    s.connect((host, port))
    print("TCP_OK")
except Exception as e:
    print(f"TCP_FAIL: {e}", file=sys.stderr)
    print(
        "Cannot reach RDS from this host. Open security group / VPN / public access, then retry.",
        file=sys.stderr,
    )
    sys.exit(2)
finally:
    s.close()
PY

PSQL=(docker run --rm --network host -e PGPASSWORD -v "$ROOT/backups:/backups" postgres:16
  psql "host=${HOST} port=${PORT} dbname=${DB} user=${USER} sslmode=require")

echo "Checking server ..."
"${PSQL[@]}" -c "SELECT version(); SELECT current_database(), current_user;"

if [[ "$RESTORE" -eq 1 ]]; then
  BACKUP="${ROOT}/backups/erp_full_backup_latest.sql"
  if [[ ! -f "$BACKUP" ]]; then
    echo "Missing backup: $BACKUP" >&2
    exit 1
  fi
  echo "Restoring $(basename "$BACKUP") (this can take several minutes) ..."
  # Note: dump used --no-owner/--no-acl; objects are created as current user.
  docker run --rm --network host \
    -e PGPASSWORD \
    -v "$ROOT/backups:/backups" \
    postgres:16 \
    psql "host=${HOST} port=${PORT} dbname=${DB} user=${USER} sslmode=require" \
    -v ON_ERROR_STOP=0 \
    -f "/backups/$(basename "$(readlink -f "$BACKUP")")"
fi

echo "Running Alembic migrations via API container image ..."
docker compose -f docker-compose.app.yml run --rm --no-deps \
  -e DATABASE_URL \
  api \
  alembic upgrade head

echo "Schema check ..."
"${PSQL[@]}" -c "SELECT nspname FROM pg_namespace WHERE nspname NOT LIKE 'pg_%' AND nspname <> 'information_schema' ORDER BY 1;"
"${PSQL[@]}" -c "SELECT count(*) AS tables FROM information_schema.tables WHERE table_schema NOT IN ('pg_catalog','information_schema');"

echo "Done. Restart API/web/worker to pick up .env:"
echo "  docker compose -f docker-compose.app.yml up -d --build api web celery-worker"
