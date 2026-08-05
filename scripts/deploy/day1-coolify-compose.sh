#!/usr/bin/env bash
# Day-1 Enterprise ERP deploy on Coolify host via Docker Compose.
# Run on the server (172.16.200.26) as a user in the docker group.
set -euo pipefail

REPO_URL="${REPO_URL:-https://github.com/ronanop/enterprise-erp.git}"
INSTALL_DIR="${INSTALL_DIR:-/opt/enterprise-erp}"
COMPOSE_FILE="${COMPOSE_FILE:-docker-compose.coolify.yml}"
ENV_FILE="${ENV_FILE:-.env.coolify}"

echo "==> Install directory: ${INSTALL_DIR}"

if ! command -v docker >/dev/null 2>&1; then
  echo "Docker is not installed. Install Docker on the Coolify server first."
  exit 1
fi

if ! docker compose version >/dev/null 2>&1; then
  echo "Docker Compose plugin not found."
  exit 1
fi

sudo mkdir -p "${INSTALL_DIR}"
sudo chown "${USER}:${USER}" "${INSTALL_DIR}"
cd "${INSTALL_DIR}"

if [[ ! -d .git ]]; then
  echo "==> Cloning ${REPO_URL}"
  git clone "${REPO_URL}" .
else
  echo "==> Pulling latest"
  git pull --ff-only
fi

if [[ ! -f "${ENV_FILE}" ]]; then
  if [[ -f .env.coolify.example ]]; then
    cp .env.coolify.example "${ENV_FILE}"
    echo "Created ${ENV_FILE} from example — edit secrets and URLs, then re-run this script."
    exit 1
  fi
  echo "Missing ${ENV_FILE}. Copy it from your workstation (scp) or create from .env.coolify.example"
  exit 1
fi

echo "==> Building images (API first, then frontends)"
docker compose -f "${COMPOSE_FILE}" --env-file "${ENV_FILE}" build api web employee-app

echo "==> Starting stack"
docker compose -f "${COMPOSE_FILE}" --env-file "${ENV_FILE}" up -d

echo ""
echo "==> Container status"
docker compose -f "${COMPOSE_FILE}" --env-file "${ENV_FILE}" ps

echo ""
echo "==> Verify API (adjust host if needed)"
set -a
# shellcheck source=/dev/null
source "${ENV_FILE}"
set +a
HEALTH_URL="http://127.0.0.1:${API_PUBLISH_PORT:-8080}/api/v1/health"
echo "curl -s ${HEALTH_URL}"
curl -sf "${HEALTH_URL}" && echo "" || echo "Health check failed — run: docker compose -f ${COMPOSE_FILE} --env-file ${ENV_FILE} logs api --tail 100"

echo ""
echo "Done. Admin: http://172.16.200.26:${WEB_PUBLISH_PORT:-3000}  Employee: http://172.16.200.26:${EMPLOYEE_PUBLISH_PORT:-3001}"
