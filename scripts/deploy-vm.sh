#!/usr/bin/env bash
# Single-command VM go-live for iConnect Plus (docker-compose.vm.yml).
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT"

ENV_FILE="${VM_ENV_FILE:-.env.vm}"
COMPOSE=(docker compose -f docker-compose.vm.yml --env-file "$ENV_FILE")

if [[ ! -f "$ENV_FILE" ]]; then
  if [[ -f .env.vm.example ]]; then
    cp .env.vm.example "$ENV_FILE"
    echo "Created $ENV_FILE from .env.vm.example — edit VM_HOST / secrets, then re-run."
    exit 1
  fi
  echo "Missing $ENV_FILE" >&2
  exit 1
fi

# shellcheck disable=SC1090
set -a
# shellcheck source=/dev/null
source "$ENV_FILE"
set +a

VM_HOST="${VM_HOST:-127.0.0.1}"

mkdir -p backups
if [[ ! -f backups/vm-seed-erp_hrms.dump ]]; then
  latest="$(ls -1t backups/erp_hrms_full_*.dump 2>/dev/null | head -n1 || true)"
  if [[ -n "$latest" ]]; then
    cp -f "$latest" backups/vm-seed-erp_hrms.dump
    echo "Seed: copied $latest → backups/vm-seed-erp_hrms.dump"
  else
    echo "WARNING: backups/vm-seed-erp_hrms.dump missing — DB will start empty." >&2
  fi
fi
if [[ ! -f backups/vm-seed-erp.dump ]]; then
  latest="$(ls -1t backups/erp_full_*.dump 2>/dev/null | head -n1 || true)"
  if [[ -n "$latest" ]]; then
    cp -f "$latest" backups/vm-seed-erp.dump
    echo "Seed: copied $latest → backups/vm-seed-erp.dump"
  fi
fi

# Keep CORS / FRONTEND aligned with VM_HOST if still placeholders
if grep -q '172.16.200.30' "$ENV_FILE" && [[ "$VM_HOST" != "172.16.200.30" ]]; then
  echo "Note: update FRONTEND_URL / CORS_ORIGINS in $ENV_FILE to match VM_HOST=$VM_HOST"
fi

echo "Building and starting VM stack…"
"${COMPOSE[@]}" up -d --build

echo
echo "Waiting for API health…"
for i in $(seq 1 60); do
  if curl -sf "http://127.0.0.1:${HTTP_PORT:-80}/api/v1/health" >/dev/null 2>&1 \
    || curl -sf "http://127.0.0.1:8000/api/v1/health" >/dev/null 2>&1; then
    echo "API is up."
    break
  fi
  sleep 5
  if [[ "$i" -eq 60 ]]; then
    echo "API did not become healthy in time. Check: docker compose -f docker-compose.vm.yml logs api" >&2
    exit 1
  fi
done

echo
echo "Live:"
echo "  App:  http://${VM_HOST}/"
echo "  API:  http://${VM_HOST}/api/v1/health"
echo
echo "Useful:"
echo "  ${COMPOSE[*]} ps"
echo "  ${COMPOSE[*]} logs -f api web nginx"
echo "  ${COMPOSE[*]} down"
