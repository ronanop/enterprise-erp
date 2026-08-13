#!/bin/sh
set -e

cd /app

if [ "${RUN_MIGRATIONS:-true}" = "true" ]; then
  echo "Running Alembic migrations..."
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
