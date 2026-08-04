# MCP server (Enterprise ERP)

Expose a **curated** subset of ERP REST operations to an ElevenLabs Conversational AI agent via the [Model Context Protocol](https://modelcontextprotocol.io). ElevenLabs connects to **one** MCP server and discovers tools dynamically instead of registering hundreds of webhooks by hand.

## Architecture

```text
ElevenLabs Agent  ──MCP (streamable HTTP)──►  FastAPI /mcp
       │                                         │
       │  Authorization: Bearer MCP_AUTH_TOKEN    ├─► tool registry (allowlist)
       │  X-ERP-Access-Token: user JWT           └─► httpx → internal REST (/api/v1/…)
```

| Piece | Location |
|--------|-----------|
| Allowlist config | `mcp-server/exposed_endpoints.json` |
| Python module | `apps/api/src/modules/mcp_server/` |
| Public transport | Streamable HTTP at `{MCP_SERVER_BASE_URL}/mcp/` |
| Optional SSE | Not enabled by default; streamable HTTP is preferred for ElevenLabs |

## How tools are generated

1. **Allowlist** — Only endpoints listed in `mcp-server/exposed_endpoints.json` are exposed. Each entry defines `tool_name`, HTTP `method`/`path`, natural-language `description`, `access` (`read` \| `write`), and optional RBAC `permission`.
2. **OpenAPI introspection** — On startup, the FastAPI app’s OpenAPI document is used to build each tool’s `inputSchema` (path/query/body parameters).
3. **Registration** — Tools are registered on a `FastMCP` instance (`mcp.server.fastmcp`) with:
   - Description prefix `[READ-ONLY]` or `[MUTATING — requires approval]`
   - `ToolAnnotations.readOnlyHint` / `destructiveHint` for ElevenLabs approval modes
4. **Execution** — Handlers call the same REST routes via `httpx` against `MCP_SERVER_BASE_URL`, forwarding `X-ERP-Access-Token` as the user’s JWT so normal API auth and tenant isolation apply.

Add or remove tools by editing the JSON file and restarting the API.

## Configuration

In `apps/api/.env` (do not commit secrets):

```env
MCP_SERVER_BASE_URL=http://127.0.0.1:8000
MCP_AUTH_TOKEN=your-long-random-integration-token
```

| Variable | Purpose |
|----------|---------|
| `MCP_SERVER_BASE_URL` | Origin used for internal ERP HTTP calls and advertised MCP base URL |
| `MCP_AUTH_TOKEN` | Bearer token ElevenLabs sends on MCP requests (`Authorization: Bearer …`) |

If `MCP_AUTH_TOKEN` is empty (local dev only), MCP transport auth is disabled — **set a token in production**.

### Headers for ElevenLabs

| Header | Required | Purpose |
|--------|----------|---------|
| `Authorization: Bearer <MCP_AUTH_TOKEN>` | Production | MCP integration auth |
| `X-ERP-Access-Token: Bearer <user JWT>` | For permissioned tools | Delegates ERP user identity for RBAC |

For the **embedded Convai widget**, pass the logged-in user's JWT as a secret dynamic variable (`secret__erp_access_token`) and set the MCP header to `Bearer {{secret__erp_access_token}}` in the ElevenLabs dashboard. See `apps/web/src/modules/agent-assistant/README.md`.

## Run locally

```bash
cd apps/api
pip install -r requirements.txt
uvicorn main:app --reload --host 0.0.0.0 --port 8000
```

MCP endpoint: `http://127.0.0.1:8000/mcp/` (streamable HTTP).

## Public URL with ngrok (ElevenLabs cloud)

ElevenLabs must reach your MCP server over HTTPS. Use [ngrok](https://ngrok.com/) to tunnel local port **8000**:

1. **One-time:** `ngrok config add-authtoken <your-token>` ([dashboard](https://dashboard.ngrok.com/get-started/your-authtoken)).
2. **Terminal A** — API:
   ```bash
   cd apps/api
   uvicorn main:app --reload --host 0.0.0.0 --port 8000
   ```
3. **Terminal B** — tunnel (from repo root):
   ```powershell
   .\mcp-server\scripts\tunnel-mcp.ps1
   ```
   On macOS/Linux: `chmod +x mcp-server/scripts/tunnel-mcp.sh && ./mcp-server/scripts/tunnel-mcp.sh`
4. Copy the printed URL, e.g. `https://abc123.ngrok-free.app/mcp/`, into the ElevenLabs agent **MCP server** settings.
5. Leave **`MCP_SERVER_BASE_URL=http://127.0.0.1:8000`** in `apps/api/.env` so tool handlers call the API in-process on localhost (do not point this at ngrok unless you intend to loop through the tunnel).

Re-print the URL anytime ngrok is already running:

```powershell
.\mcp-server\scripts\print-mcp-public-url.ps1
```

Optional static hostname (paid ngrok): see `mcp-server/ngrok.yml.example`.

## Connect to ElevenLabs

1. In the ElevenLabs agent dashboard, add an **MCP server** integration.
2. URL: your **ngrok** URL + `/mcp/` (e.g. `https://abc123.ngrok-free.app/mcp/`) or your deployed `https://<host>/mcp/`.
3. Auth: Bearer token = `MCP_AUTH_TOKEN`.
4. Configure approval: auto-approve tools with `readOnlyHint: true`; require approval for mutating tools.
5. Ensure the agent passes the end-user ERP JWT via `X-ERP-Access-Token` when calling permissioned tools.

## Tests

```bash
cd apps/api
pytest src/tests/integration/mcp_server/test_mcp_server_smoke.py -q
```

Smoke test checks allowlist load, registered tool names, and a read-only health delegation call.

## Registered read tools (v2 allowlist)

| Tool | Description |
|------|-------------|
| `erp_health_check` | API liveness and DB status |
| `list_leads` | Paginated CRM leads (`q`, `status`, `limit`, `offset`) |
| `get_lead` | Single lead by `id` |
| `list_orders` | Paginated sales orders |
| `get_order` | Single order by `id` |
| `list_customers` | Paginated customers |
| `get_customer` | Single customer by `id` |
| `list_invoices` | Paginated sales invoices |
| `get_invoice` | Single invoice by `id` |
| `list_products` | Paginated products |
| `get_product` | Single product by `id` |

Bump `version` in `exposed_endpoints.json` when adding tools (forces MCP re-registration).

**Note:** Customer and product agent lists use `/api/v1/agent/customers` and `/api/v1/agent/products` so they do not collide with master-data `GET /api/v1/customers` and `GET /api/v1/products` (different pagination contract).
