# FRD — Marketing & Social Media (Content Intelligence)

**Module key:** `marketing`  
**Owner:** connect  
**Status:** v1 implementation  
**Architecture:** Modular monolith (FastAPI / SQLAlchemy / Celery) per Architecture Lock v1.1

## 1. Purpose

Provide AI-assisted content research, generation, brand voice, campaign planning, social publishing calendar, and analytics inside the ERP — without a separate identity, approval, or notification stack.

## 2. Scope (v1)

| Capability | In v1 |
|------------|-------|
| Marketing campaigns (link to CRM campaign UUID optional) | Yes |
| Platforms master + social accounts | Yes |
| Content requests + AI agent pipeline (Celery) | Yes |
| Generated content + versions + AI scores | Yes |
| Brand voice + sources | Yes |
| Research & trend reports | Yes |
| Competitors | Yes |
| Content calendar + publish jobs | Yes |
| Analytics summary API | Yes |
| Approvals | Via Foundation Workflow (submit hook) |
| Notifications | Via Foundation Notification Engine |
| Auth / RBAC / tenants | Foundation only |

## 3. Out of scope (v1)

- Parallel Express/Prisma service
- Module-owned users/sessions
- Live OAuth publish to Instagram/LinkedIn (stub publish jobs only)
- Full Content Intelligence OS feature parity (flows, whiteboard, marketplace)

## 4. Permissions

Prefix `marketing.<resource>:<action>` — see `modules/marketing/permissions.py`.

## 5. API prefix

`/api/v1/marketing/...`

## 6. Data schema

PostgreSQL schema `marketing`, tables prefixed `mkt_`.

## 7. Integration

- Optional `crm_campaign_id` UUID on `mkt_campaign` (no cross-module FK write)
- Document Management for heavy assets (future); v1 stores brand source metadata only
