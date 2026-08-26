#!/usr/bin/env bash
# Expose local ERP API (MCP at /mcp/) via ngrok for ElevenLabs.
set -euo pipefail

PORT="${API_PORT:-8000}"
if [[ "${1:-}" =~ ^[0-9]+$ ]]; then
  PORT="$1"
fi

if ! command -v ngrok >/dev/null 2>&1; then
  echo "ngrok not found. Install from https://ngrok.com/download" >&2
  exit 1
fi

echo "Tunneling http://127.0.0.1:${PORT} (MCP: /mcp/)"
echo "Start API first: cd apps/api && uvicorn main:app --host 0.0.0.0 --port ${PORT}"
echo ""

ngrok http "$PORT" --log=stdout &
NGROK_PID=$!

cleanup() {
  kill "$NGROK_PID" 2>/dev/null || true
}
trap cleanup EXIT INT TERM

for _ in $(seq 1 30); do
  if URL=$(curl -sf http://127.0.0.1:4040/api/tunnels | python -c "
import json,sys
data=json.load(sys.stdin)
for t in data.get('tunnels',[]):
    if t.get('proto')=='https':
        print(t['public_url'].rstrip('/'))
        break
" 2>/dev/null); then
    if [[ -n "$URL" ]]; then
      echo "========================================"
      echo "ElevenLabs MCP server URL:"
      echo "  ${URL}/mcp/"
      echo ""
      echo "Keep MCP_SERVER_BASE_URL=http://127.0.0.1:${PORT} in apps/api/.env"
      echo "Dashboard: http://127.0.0.1:4040"
      echo "========================================"
      break
    fi
  fi
  sleep 1
done

wait "$NGROK_PID"
