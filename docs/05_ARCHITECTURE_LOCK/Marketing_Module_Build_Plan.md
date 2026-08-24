# Marketing & Social Media — Detailed Build To-Do

## Phase A — Docs & design
- [x] FRD slice (`docs/02_FRD/FRD-Marketing-Social-Media.md`)
- [x] DBS slice (`docs/04_DBS/DBS_Marketing_Social_Media.md`)
- [x] Design system page override (`design-system/.../pages/marketing.md`)

## Phase B — Backend scaffold
- [x] Module package under `apps/api/src/modules/marketing/`
- [x] Enums, permissions, dependencies
- [x] 14 ORM models (`mkt_*`, schema `marketing`)
- [x] Repositories + services + thin routers
- [x] Agent pipeline engine + Celery tasks
- [x] CRM soft-link adapter (UUID only)

## Phase C — Platform wiring
- [x] Router in `shared/router.py`
- [x] Alembic env + Celery autodiscover
- [x] Migrations `0515`–`0517` (+ stub `0514` for local DB head)
- [x] Migrations applied locally

## Phase D — Frontend
- [x] `config/modules.ts` + `navigation.ts` Megaphone icon
- [x] Workspace nav, dashboard, content studio, analytics
- [x] Generic `[resource]` list pages
- [x] `marketing-service.ts` API client

## Phase E — Follow-ups (v1.1+)
- [ ] Wire content approve → Foundation Workflow Engine
- [ ] Notifications via Notification Engine on approval/publish
- [ ] Live OAuth social publishers via Integration Hub
- [ ] OpenAI live adapters (replace deterministic pipeline)
- [ ] Full Content Intelligence feature parity (flows, inbox, marketplace)
