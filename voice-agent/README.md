# Voice agent (ElevenLabs Conversational AI)

This module connects the ERP UI to a **private** ElevenLabs agent. Speech recognition, LLM, and TTS run in ElevenLabs over WebSocket; this repo only handles auth, signed URLs, client tools in the browser, and stub ERP APIs for server/webhook tools.

## Architecture

```text
Browser (Next.js)                    ERP API (FastAPI)              ElevenLabs Cloud
─────────────────                    ─────────────────              ────────────────
@elevenlabs/react                    GET /api/v1/voice-agent/         Agent (prompt, KB,
ConversationProvider                   signed-url  + JWT              tools) — dashboard
  ├─ clientTools:                      XI_API_KEY + AGENT_ID
  │    navigateToCRM, showLead         GET /api/v1/leads/{id}  ◄── server tools (webhooks)
  └─ startSession({ signedUrl })       GET /api/v1/orders/{id} ◄── configured in dashboard
        ───────── WebSocket ─────────────────────────────────────────►
```

## Configuration

Set in `apps/api/.env` (never commit real keys):

| Variable | Where | Purpose |
|----------|--------|---------|
| `XI_API_KEY` | Server only | ElevenLabs API key for `get-signed-url` |
| `ELEVENLABS_AGENT_ID` | Server only | Private agent ID from the ElevenLabs dashboard |

Create and configure the agent in the ElevenLabs UI: **MCP server** (see `mcp-server/README.md`), **client tools** (see `apps/web/src/modules/agent-assistant/README.md`).

## Frontend (`apps/web/src/modules/voice-agent/`)

- `VoiceAgentProvider` — wraps `ConversationProvider` and registers shared **client tools** (`agent-assistant`).
- `VoiceAgentControls` — mic consent, `getUserMedia`, fetches signed URL, `useConversationControls` / `useConversationStatus`.
- Route: `/voice-agent`.

## Backend (`apps/api/src/modules/voice_agent/`)

- `GET /api/v1/voice-agent/signed-url` — authenticated; returns `{ signed_url }` (expires ~15 minutes).
- `GET /api/v1/leads/{id}` — authenticated stub for agent server tools.
- `GET /api/v1/orders/{id}` — authenticated stub for agent server tools.

Replace stubs with CRM/Sales services when wiring production tools.

## Local smoke test

1. Set `XI_API_KEY` and `ELEVENLABS_AGENT_ID`, restart the API.
2. Log in to the web app, open **Voice assistant** (`/voice-agent`).
3. Start session → allow microphone → confirm WebSocket connects.
4. In the dashboard, ensure client tool names match `navigateToCRM` and `showLead` (`leadId` parameter).
