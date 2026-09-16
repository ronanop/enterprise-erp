#!/bin/sh
set -e

cd /app

# Coolify / production preflight — fail fast with clear messages
if [ -z "${DATABASE_URL:-}" ]; then
  echo "ERROR: DATABASE_URL is required (AWS RDS PostgreSQL connection string)." >&2
  echo "Example: postgresql+psycopg://USER:PASS@HOST:5432/DB?sslmode=require" >&2
  exit 1
fi

backend="$(printf '%s' "${OBJECT_STORAGE_BACKEND:-s3}" | tr '[:upper:]' '[:lower:]')"
if [ "$backend" = "s3" ]; then
  if [ -z "${S3_BUCKET:-}" ] || [ -z "${S3_REGION:-}" ]; then
    echo "ERROR: S3_BUCKET and S3_REGION are required when OBJECT_STORAGE_BACKEND=s3." >&2
    exit 1
  fi
  if [ -z "${AWS_ACCESS_KEY_ID:-}" ] || [ -z "${AWS_SECRET_ACCESS_KEY:-}" ]; then
    echo "WARNING: AWS_ACCESS_KEY_ID / AWS_SECRET_ACCESS_KEY empty — relying on instance IAM role." >&2
  fi
fi

# Align Celery broker with RabbitMQ service credentials when unset
if [ -z "${CELERY_BROKER_URL:-}" ]; then
  export CELERY_BROKER_URL="amqp://${RABBITMQ_USER:-erp}:${RABBITMQ_PASSWORD:-erp_change_me}@rabbitmq:5672//"
fi

if [ "${RUN_MIGRATIONS:-true}" = "true" ]; then
  echo "Running Alembic migrations against RDS..."
  alembic upgrade head
fi

PORT="${PORT:-${API_PORT:-8000}}"
export API_PORT="$PORT"

case "${1:-api}" in
  api)
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
