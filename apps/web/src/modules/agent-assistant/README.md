# ERP agent assistant (browser)

The ElevenLabs **Convai widget** (all logged-in pages) and **Voice assistant** (`/voice-agent`) share client tools that:

- Navigate any module screen listed in `config/modules.ts`
- Call the same REST APIs as the UI (`erpApiGet` uses the logged-in user JWT and RBAC)

## ElevenLabs dashboard — client tools

Create client tools on your agent with **exact** names (case-sensitive):

| Tool | Parameters | Blocking |
|------|------------|----------|
| `listAppScreens` | none; optional `moduleKey` to list screens for one module | optional |
| `navigateToPath` | `path` (string) | recommended |
| `navigateToModuleResource` | `moduleKey`, `resourceKey` | recommended |
| `openRecordPage` | `moduleKey`, `resourceKey`, `recordId` | recommended |
| `erpApiGet` | `apiPath` (string, e.g. `/leads`), optional `queryJson` (JSON object string) | **yes** |
| `listCrmLeads` | optional `q`, `status`, `limit`, `offset` | **yes** |
| `getCrmLead` | `leadId` (or `id`) | **yes** |
| `getCurrentUser` | none | optional |
| `navigateToCRM` | none | optional |
| `showLead` | `leadId` | **yes** |

Prompt hint for the agent:

> The user is already logged into the ERP in the browser. For CRM leads, always use client tools **`listCrmLeads`** / **`getCrmLead`** (or **`erpApiGet`** with `/leads`) — do **not** ask for a token. Use MCP `list_leads` only when client tools are unavailable. For navigation, use `navigateToPath` or `navigateToModuleResource`.

## MCP server (cloud tools)

MCP tools such as `list_leads` require the **user JWT** on every MCP request. Without it, the API returns: *Missing ERP user token. Send header X-ERP-Access-Token…*

### Wire the JWT (one-time in ElevenLabs)

1. **Agent → Personalization → Dynamic variables** — add a **secret** variable named `secret__erp_access_token` (value can be a placeholder; the widget overwrites it at runtime).
2. **Integrations → your MCP server → HTTP headers** — add:
   - `X-ERP-Access-Token` = `Bearer {{secret__erp_access_token}}`
3. Keep `Authorization` = `Bearer <MCP_AUTH_TOKEN>` (from `apps/api/.env`).

The embedded widget sets `secret__erp_access_token` on the element **and** refreshes it on each `elevenlabs-convai:call` from `localStorage` (`erp_access_token`).

### Prefer client tools in the web app

| User asks | Use (embedded ERP) | Use (MCP only) |
|-----------|-------------------|----------------|
| List CRM leads | `listCrmLeads` | `list_leads` + JWT header |
| Open CRM | `navigateToCRM` | — |

Expand read tools by editing the allowlist and restarting the API. Browser `erpApiGet` / `listCrmLeads` use the session automatically — no MCP header setup required.

## Troubleshooting

### `Client tool … is not defined on client {}`

The Convai widget did not register tools before the call started. Hard-refresh after login, start a **new** conversation, and ensure tool names match this README exactly.

### `LLM Cascade Error` in the widget

Usually a **tool or MCP call failed** and ElevenLabs could not recover. Check in order:

1. **ElevenLabs → Conversations** — open the conversation id shown in the widget and read the failed tool step.
2. **MCP** — ngrok + API running; MCP URL ends with `/mcp/`; `Authorization: Bearer MCP_AUTH_TOKEN`; header `X-ERP-Access-Token: Bearer {{secret__erp_access_token}}` on the MCP integration.
3. **Isolate client vs MCP** — temporarily disable MCP on the agent and test only `navigateToCRM` / `navigateToPath`. Navigation should work without MCP.
4. **Oversized tool output** — use `listAppScreens` with `moduleKey` (e.g. `crm`), not the full catalog in one call.
5. **Agent LLM** — in agent settings, switch to a default ElevenLabs model (custom LLM endpoints often cause cascade failures).

Client tools always return a string (errors are returned as `Tool error (…)` instead of throwing) so a single failed navigation should not crash the session after the latest app build.

### Bot says it needs a “user access token” for CRM data

The agent called the **MCP** tool `list_leads` without `X-ERP-Access-Token`. Fix either:

- **Recommended (web app):** Add client tools `listCrmLeads` / `getCrmLead` in the dashboard and update the system prompt to use them for CRM reads (see above).
- **MCP path:** Configure `X-ERP-Access-Token: Bearer {{secret__erp_access_token}}` on the MCP integration and declare `secret__erp_access_token` as a secret dynamic variable.
