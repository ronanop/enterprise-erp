# iConnect Plus — System Overview (as built)

**Updated:** 2026-10-09  
**Baseline:** Architecture Lock v1.1 · ADR-001 · ADR-002  
**Addendum:** `docs/05_ARCHITECTURE_LOCK/ERP_Architecture_Addendum_v1.2.md`

## 1. Shape

```text
Browser (Next.js) ──HTTPS──► FastAPI (/api/v1)
                                │
                    Router → Service → Repository → PostgreSQL
                                │
                         Platform ports / facades
                                │
                    Outbox ──Celery──► notify / audit / finance /
                                       integration / read-models
```

- **Pattern:** Modular monolith · Clean Architecture · DDD  
- **Backend flow (mandatory):** Router → Service → Repository → Database  
- **No** NestJS / Prisma / Mongo primary DB / business logic in routers / UI→DB

## 2. Stack (locked + local reality)

| Layer | Technology |
|-------|------------|
| Web | Next.js 16+, TypeScript, Tailwind, ShadCN |
| UI theme | White canvas + emerald primary (`≈ #059669`); white left rail — tokens in `apps/web/src/app/globals.css`, mirrored by `design-system/enterprise-erp-platform/MASTER.md` |
| API | Python 3.13+, FastAPI, SQLAlchemy 2, Alembic, Pydantic v2 |
| Jobs | Celery + Celery Beat, RabbitMQ broker, Redis backend |
| OLTP | PostgreSQL |
| Objects | MinIO (local) / AWS S3 (cloud) |
| AV | ClamAV on upload |
| Auth | User id + password (HRMS-synced logins) · JWT in **HttpOnly cookies** |
| Deploy | Docker Compose · Coolify (`docs/09_OPS/coolify-deploy.md`) |

OpenSearch / Kubernetes / warehouse extract remain **evolution-gated** (`modules/platform/evolution.py`).

## 3. Repository layout

```text
apps/
  api/          FastAPI (src/modules/*, alembic/, workers/)
  web/          Next.js HRMS admin UI
docs/           Baseline pack + 00_CURRENT living docs
design-system/  UI/UX Pro Max tokens for iConnect Plus
docker/         MinIO build contexts
```

## 4. Platform package (`modules/platform`)

Cross-cutting seams used by business modules:

| Seam | Role |
|------|------|
| Ports / adapters | Finance posting, inventory stock, master-data lookup, workflow, notify, audit, outbox, numbering, integration |
| Compat facades | `PlatformAuditFacade`, `PlatformNotifyFacade` (migrate callers off raw foundation services) |
| Outbox | `FndOutboxMessage` + drain/purge Celery tasks |
| Numbering SSOT | `generate_with_ssot` / `next_document_number` |
| Approval matrix | `policies.APPROVAL_POLICIES` + `workflow_gate` (tenant override + default provision) |
| Optimistic lock | `VersionMixin` → SQLAlchemy `version_id_col` → HTTP 409 |
| Encryption | `EncryptedText` / `EncryptedBankJSON` · `FIELD_ENCRYPTION_KEYS` |
| Idempotency | Tenant-scoped `FndIdempotencyRecord` · system jobs `FndJobRun` |
| Read models | Finance / inventory / payroll facts projected from outbox |
| SLO / ops | `/platform/slo/*`, `/platform/metrics`, `/platform/ops/status` |
| Master published | `modules.master_data.published` read projections (no cross-module ORM writes) |

Architecture CI gates (unit):

- Zero cross-module ORM imports outside `adapters/` / `ports/`
- Route + web permission codes ⊆ permission catalog
- Repository query tenant/company scope (reviewed allowlist)
- OpenAPI generates with unique operationIds

## 5. Request path (sync)

1. `RequestContextMiddleware` sets `X-Request-ID` and platform observability context  
2. Auth / RBAC (`require_permission`) → `TenantContext`  
3. Thin router → service → repository (tenant filters)  
4. Side effects via outbox / facades (notify, audit), not ad-hoc cross-module SQL  
5. Concurrent updates with stale `version` → **409 Conflict**

## 6. Async path

| Job | Cadence | Notes |
|-----|---------|--------|
| `platform.outbox_drain` | ~15s | Dispatch notify/audit/finance/integration/domain |
| `platform.outbox_purge` | hourly claim / daily window | Retention on processed outbox |
| `platform.retention_purge` | hourly claim / daily window | Idempotency + job runs + old notifications |
| `inventory.reservation_cleanup` | daily window | Release stale reservations |
| Domain beat tasks | per module | Wrapped with `system_job` where side-effecting |

Celery inherits `x_request_id` for correlation.

## 7. Multi-tenancy & data rules

- UUID PKs · audit columns · `tenant_id` / `company_id` / `branch_id` on transactional tables  
- Soft delete only on business tables  
- Schema changes via Alembic only  
- Sensitive columns (tax, PAN, Aadhaar, bank, integration secrets) encrypted at rest  

## 8. AuthZ

- Permission catalogs live in each module’s `permissions.py`  
- Aggregated by `modules.platform.permission_catalog`  
- Seeded to `sec_permission` (migration `0633_permission_catalog_sync`)  
- UI registry: `apps/web/src/config/modules.ts` (must stay aligned with API)

## 9. Evolution (Tier D — gated)

Do **not** extract microservices, stand up a warehouse, or mandate K8s until
`ExtractReadiness.ready` is true for the context (`ports`, `outbox`, `orm_debt`,
`slo_green`, `team_ownership`). Today finance/inventory/procurement/sales have
ports + outbox + ORM debt cleared; SLO-green and ownership remain open.
