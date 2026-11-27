#!/bin/sh
set -e

cd /app

echo "entrypoint: role=${1:-api} environment=${ENVIRONMENT:-unknown}"

# Coolify / production preflight — fail fast with clear messages
if [ -z "${DATABASE_URL:-}" ]; then
  echo "ERROR: DATABASE_URL is required (Postgres connection string)." >&2
  echo "RDS example: postgresql+psycopg://USER:PASS@HOST:5432/DB?sslmode=require" >&2
  exit 1
fi

# Neon / standard Postgres URIs default to psycopg2; this image ships psycopg3.
case "${DATABASE_URL}" in
  postgresql+psycopg://*|postgres+psycopg://*) ;;
  postgresql://*) export DATABASE_URL="postgresql+psycopg://${DATABASE_URL#postgresql://}" ;;
  postgres://*) export DATABASE_URL="postgresql+psycopg://${DATABASE_URL#postgres://}" ;;
esac

# Fail fast on unreachable DB instead of hanging Coolify for minutes.
case "${DATABASE_URL}" in
  *connect_timeout=*) ;;
  *\?*) export DATABASE_URL="${DATABASE_URL}&connect_timeout=10" ;;
  *) export DATABASE_URL="${DATABASE_URL}?connect_timeout=10" ;;
esac

python -c "from urllib.parse import urlparse; import os; u=urlparse(os.environ['DATABASE_URL']); print(f'DB target: {u.hostname}:{u.port or 5432}/{ (u.path or \"/\").lstrip(\"/\") }')"

backend="$(printf '%s' "${OBJECT_STORAGE_BACKEND:-local}" | tr '[:upper:]' '[:lower:]')"
if [ "$backend" = "s3" ]; then
  if [ -z "${S3_BUCKET:-}" ] || [ -z "${S3_REGION:-}" ]; then
    echo "WARNING: OBJECT_STORAGE_BACKEND=s3 but S3_BUCKET/S3_REGION missing — falling back to local storage." >&2
    export OBJECT_STORAGE_BACKEND=local
    export ASSET_STORAGE_BACKEND=local
  elif [ -z "${AWS_ACCESS_KEY_ID:-}" ] || [ -z "${AWS_SECRET_ACCESS_KEY:-}" ]; then
    echo "WARNING: AWS_ACCESS_KEY_ID / AWS_SECRET_ACCESS_KEY empty — relying on instance IAM role." >&2
  fi
fi

# Align Celery broker with RabbitMQ service credentials when unset
if [ -z "${CELERY_BROKER_URL:-}" ]; then
  export CELERY_BROKER_URL="amqp://${RABBITMQ_USER:-erp}:${RABBITMQ_PASSWORD:-erp_change_me}@rabbitmq:5672//"
fi

if [ "${RUN_MIGRATIONS:-true}" = "true" ]; then
  # Store-review Neon: greenfield alembic from 0001 breaks on live-metadata
  # early revisions (cross-schema FKs). Bootstrap ORM + stamp instead.
  if [ "${ESS_STORE_REVIEW_MODE:-false}" = "true" ]; then
    echo "Store-review mode: bootstrapping schema (create_all + alembic stamp)…"
    if ! python -m scripts.bootstrap_store_review_schema; then
      echo "ERROR: store-review schema bootstrap failed." >&2
      exit 1
    fi
    # Free Render has no Shell — seed review users on boot (idempotent).
    if [ "${SEED_STORE_REVIEW:-true}" = "true" ]; then
      echo "Store-review mode: seeding review accounts…"
      if ! python -m scripts.seed_store_review; then
        echo "ERROR: store-review seed failed." >&2
        exit 1
      fi
    fi
  else
    # Revision ids in this repo often exceed Alembic's default VARCHAR(32)
    # (e.g. 0687_prj_site_install_split_checkboxes → StringDataRightTruncation).
    echo "Ensuring alembic_version.version_num fits long revision ids…"
    if ! python -m scripts.widen_alembic_version; then
      echo "ERROR: could not widen alembic_version.version_num." >&2
      exit 1
    fi
    echo "Running Alembic migrations (connect_timeout=10)…"
    if ! alembic upgrade head; then
      echo "ERROR: alembic upgrade head failed." >&2
      echo "Most common Coolify cause: RDS security group does not allow this EC2 on port 5432." >&2
      echo "Also verify DATABASE_URL user/password/db name and sslmode=require." >&2
      echo "If you see StringDataRightTruncation on alembic_version, re-run widen_alembic_version." >&2
      exit 1
    fi
  fi
  echo "Migrations complete."
fi

PORT="${PORT:-${API_PORT:-8000}}"
export API_PORT="$PORT"

case "${1:-api}" in
  api)
    echo "Starting uvicorn on 0.0.0.0:${PORT}"
    exec uvicorn main:app --host "${API_HOST:-0.0.0.0}" --port "$PORT" --app-dir src
    ;;
  worker)
    exec celery -A workers.celery_app worker -l "${CELERY_LOG_LEVEL:-info}"
    ;;
  beat)
    exec celery -A workers.celery_app beat -l "${CELERY_LOG_LEVEL:-info}"
    ;;
  migrate)
    alembic upgrade head
    ;;
  *)
    exec "$@"
    ;;
esac
