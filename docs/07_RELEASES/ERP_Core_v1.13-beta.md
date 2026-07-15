# ERP Core v1.13-beta — Release Notes

| Field | Value |
|-------|--------|
| **Document Type** | Enterprise Release Notes |
| **Release Name** | ERP Core v1.13-beta |
| **Release Status** | Beta Development Release |
| **Architecture Lock** | v1.1 — Maintained |
| **Prepared As** | Enterprise Solution Architect · ERP Product Architect · Technical Documentation Lead · Release Manager · Principal Software Engineer |
| **Classification** | Internal — Confidential |
| **Predecessor** | [ERP Core v1.12-beta](./ERP_Core_v1.12-beta.md) |
| **Ready For** | Sprint 19 — Governance, Risk & Compliance (GRC) |

---

## 1. Release Information

| Field | Value |
|-------|--------|
| **Version** | ERP Core v1.13-beta |
| **Status** | Beta Development Release |
| **Date** | 2026-07-15 |
| **Previous Release** | ERP Core v1.12-beta |
| **Architecture Lock** | v1.1 — Preserved |
| **Recommended Git Tag** | `v1.13-beta` |

---

## 2. Sprint 18 Highlights

Sprint 18 delivered the **Document Management System (DMS)** domain (FRD-19 / ERD_18) as the centralized enterprise document repository — folders → documents → versions → classification → access → collaboration → governance → retention / archive — while **existing masters remain authoritative (C-01)**. No duplicate customer / employee / department masters. Chargeable / recoverable posting occurs only through Finance `PostingService.post_system_journal()`, storing `finance_journal_id` UUID references only. Helpdesk / Service / Project / Asset / CRM / Inventory / Manufacturing / Quality peer context uses UUID-only refs with **no peer ORM writes**.

| Capability | Delivery |
|------------|----------|
| **Document Module** | `apps/api/src/modules/document/` — Clean Architecture package (domain, models, repositories, engines, services, routers, adapters, tasks) |
| **Folders** | Hierarchical repository containers |
| **Documents** | Central document register with submit / approve / publish |
| **Document Versions** | Immutable version history and current pointer |
| **Metadata** | Key / value classification attributes |
| **Tags** | Controlled tagging vocabulary |
| **Tag Mapping** | Document ↔ tag association |
| **Permissions** | ACL grants / revoke |
| **Sharing** | Time-bound share links and grants |
| **Comments** | Collaboration annotations |
| **Approvals** | Document approval workflow with submit / complete |
| **Workflows** | Domain workflow configuration rows |
| **Checkouts** | Exclusive checkout / check-in control |
| **Audit** | Document action audit ledger |
| **Attachments** | Supplemental file metadata (URI / hash) |
| **Templates** | Document template catalog |
| **Template Fields** | Template field definitions |
| **Retention Policies** | Retention rules with submit / approve |
| **Archive** | Archive batches with submit / approve |
| **Notifications** | DMS-scoped notification delivery ledger |
| **Reports** | Repository / compliance report snapshots |
| **Engines (20)** | Folder · Document · DocumentVersion · DocumentMetadata · DocumentTag · DocumentTagMap · DocumentPermission · DocumentShare · DocumentComment · DocumentApproval · DocumentWorkflow · DocumentCheckout · DocumentAudit · DocumentAttachment · Template · TemplateField · RetentionPolicy · Archive · Notification · Report |

**Services:** `DocumentApplicationService`, `FolderService`, `DocumentService`, `DocumentVersionService`, `MetadataService`, `TagService`, `PermissionService`, `ShareService`, `CommentService`, `ApprovalService`, `WorkflowService`, `CheckoutService`, `DocumentAuditService`, `AttachmentService`, `TemplateService`, `RetentionPolicyService`, `ArchiveService`, `NotificationService`, `DocumentReportService`, **`DocumentIntegrationService`**.

**Supporting delivered items:** document numbering (`DOC` / `DAPR` / `DOUT` / `DARC` / `DSHR`), Celery jobs (`retention_policy_runner`, `archive_scheduler`, `document_expiry_notifications`, `document_review_reminders`, `metadata_index_refresh`, `retry_finance_posting`), RBAC roles (`DOCUMENT_MANAGER`, `DOCUMENT_EDITOR`, `DOCUMENT_REVIEWER`, `DOCUMENT_ADMIN`), and workflows (`DOC_DOCUMENT_APPROVAL`, `DOC_DOCUMENT_PUBLISH`, `DOC_DOCUMENT_CHECKOUT`, `DOC_DOCUMENT_ARCHIVE`, `DOC_RETENTION_APPROVAL`).

---

## 3. Document Management Module

| Item | Value |
|------|--------|
| **Schema** | `document` |
| **Prefix** | `doc_` |
| **Business Tables** | **20** |
| **ERD** | ERD_18 Document Management (locked) |
| **FRD** | FRD-19 Document Management System |
| **API mount** | `/api/v1/documents` |

**Tables:** `doc_folder`, `doc_document`, `doc_document_version`, `doc_document_metadata`, `doc_document_tag`, `doc_document_tag_map`, `doc_document_permission`, `doc_document_share`, `doc_document_comment`, `doc_document_approval`, `doc_document_workflow`, `doc_document_checkout`, `doc_document_audit`, `doc_document_attachment`, `doc_template`, `doc_template_field`, `doc_retention_policy`, `doc_archive`, `doc_notification`, `doc_report`.

**Coverage:** folders · documents · versions · metadata · tags · tag maps · permissions · shares · comments · approvals · workflows · checkouts · audits · attachments · templates · template fields · retention policies · archives · notifications · reports.

**API mount:** `/api/v1/documents` — folders, documents (+ submit / approve / publish), document-versions, document-metadata, document-tags, document-tag-maps, document-permissions, document-shares, document-comments, document-approvals (+ submit / complete), document-workflows, document-checkouts (+ submit / complete / checkin), document-audits, document-attachments, templates, template-fields, retention-policies (+ submit / approve), archives (+ submit / approve), notifications, reports.

---

## 4. Cross Module Integrations

Document Management **never** duplicates customer, employee, or department masters. **Existing masters remain authoritative (C-01)**. Peer domains are consumed via FKs, service adapters, or UUID-only references — **never** via direct ORM writes outside `doc_*`.

| Module | Integration |
|--------|-------------|
| **Master Data** | **`master_employee` · `master_customer` only (C-01)** — **no duplicate masters** |
| **Organization** | **`org_department` only** — no DMS department master |
| **Finance** | Store **`finance_journal_id` UUID only**; posting **only** through `PostingService.post_system_journal()` — **no direct `fin_*` writes** |
| **Helpdesk** | Optional `helpdesk_ticket_id` **UUID only** — **no `hd_*` FK / no writes** |
| **Service** | Optional `service_request_id` **UUID only** — **no `svc_*` FK / no writes** |
| **Project** | Optional `project_id` **UUID only** — **no FK / no writes** |
| **Asset** | Optional `asset_id` **UUID only** — **no `ast_*` FK / no writes** |
| **CRM** | Optional `crm_opportunity_id` **UUID only** — **no FK / no writes** |
| **Inventory** | Optional `inventory_ref_id` **UUID only** — **no FK / no writes** |
| **Manufacturing** | Optional `production_order_id` **UUID only** — **no FK / no writes** |
| **Quality** | Optional `quality_ref_id` **UUID only** — **no FK / no writes** |
| **HR** | Employee refs via Master Data — **read only / no `hr_*` writes** |
| **Payroll** | Optional labor cost **read** — **no `pay_*` writes** |
| **Recruitment** | **Read only / no writes** |
| **Foundation** | **Workflow** (`DOC_DOCUMENT_APPROVAL`, `DOC_DOCUMENT_PUBLISH`, `DOC_DOCUMENT_CHECKOUT`, `DOC_DOCUMENT_ARCHIVE`, `DOC_RETENTION_APPROVAL`); **RBAC** (`document.*` permissions; roles `DOCUMENT_MANAGER`, `DOCUMENT_EDITOR`, `DOCUMENT_REVIEWER`, `DOCUMENT_ADMIN` with `status='active'`) |

---

## 5. APIs

| Metric | Value |
|--------|------:|
| **Total Routes** | **1167** |
| **OpenAPI Paths** | **756** |
| **Document Routes** | **92** |
| **Document OpenAPI Paths** | **52** |

Swagger (`/docs`) and OpenAPI (`/openapi.json`) both return **200**; Document Management APIs are visible under `/api/v1/documents/*`.

---

## 6. Database

| Item | Value |
|------|--------|
| **Alembic Head** | `0332_seed_document_workflows` |
| **Migration range (this release delta)** | `0311_create_document_schema` → `0332_seed_document_workflows` |
| **Approximate business tables** | Approximately **308** (~288 at v1.12-beta + 20 Document) |
| **Schemas** | `foundation`, `audit`, `config`, `organization`, `master`, `finance`, `sales`, `procurement`, `inventory`, `manufacturing`, `quality`, `crm`, `hr`, `payroll`, `recruitment`, `project`, `asset`, `service`, `helpdesk`, **`document`** (**20**) |

```text
0311_create_document_schema
        ↓
0332_seed_document_workflows
```

---

## 7. Quality Gates

| Gate | Status |
|------|--------|
| **Alembic Upgrade** | **PASS** — head `0332_seed_document_workflows` |
| **FastAPI Startup** | **PASS** — Application startup complete (validated on port **8031**; port 8000 unavailable) |
| **Swagger** | **PASS** (`/docs` 200) |
| **OpenAPI** | **PASS** (`/openapi.json` 200) |
| **Ruff** | **PASS** |
| **MyPy** | **PASS (1577 files)** |
| **Pytest** | **PASS (241)** |

Validation completed successfully. Head `0332_seed_document_workflows` confirmed, application startup succeeded, `/docs` and OpenAPI generation passed, and Document Management routes registered.

**Fixes applied during validation (minimal):**

| Fix | Detail |
|-----|--------|
| Test module basename collision | Renamed Sprint 18 unit/security tests to `test_dms_engines.py`, `test_dms_tasks.py`, `test_dms_permissions.py` to avoid clash with sales `test_document_engines.py` |

---

## 8. Architecture Status

| Principle | Confirmation |
|-----------|--------------|
| **Architecture Lock v1.1** | **Preserved** — no Architecture Lock changes |
| **No redesign** | Prior sprints unmodified except required integration wiring (router / Celery / Alembic env / mypy package registration) |
| **Clean Architecture** | Router → Service → Repository → Database maintained |
| **DDD** | Document domain enums, exceptions, entities, value objects, engines |
| **Modular Monolith** | New `modules/document` package; no service-boundary redesign |
| **Previous modules unchanged** | Confirmed — Foundation · Organization · Master Data · Finance · Sales · Procurement · Inventory · Manufacturing · Quality · CRM · HR · Payroll · Recruitment · Project · Asset · Service · Helpdesk untouched except required wiring |

Stack unchanged: FastAPI · SQLAlchemy 2.0 · Alembic · PostgreSQL · Redis · Celery.

---

## 9. Sprint 19 Roadmap

| Attribute | Value |
|-----------|--------|
| **Next Release** | ERP Core **v1.14-beta** (planned) |
| **Sprint** | **Sprint 19 — Governance, Risk & Compliance (GRC)** |
| **Primary domain** | **Governance, Risk & Compliance** |

**Planned scope (planning only — no implementation in this release):**

- GRC policies / controls / risk register foundation
- Continuity with Master Data party / employee masters (C-01)
- Optional cross-links to Document · Helpdesk · Finance via UUID / services only
- No redesign of Document · Helpdesk · Service · Asset modules

---

## 10. Release Summary

| Item | Confirmation |
|------|----------------|
| Release document | `docs/07_RELEASES/ERP_Core_v1.13-beta.md` |
| Prior releases unmodified | `ERP_Core_v1.0-alpha.md` · `v1.1-beta` · `v1.2-beta` · `v1.3-beta` · `v1.4-beta` · `v1.5-beta` · `v1.6-beta` · `v1.7-beta` · `v1.8-beta` · `v1.9-beta` · `v1.10-beta` · `v1.11-beta` · `v1.12-beta` unchanged |
| **Version** | **ERP Core v1.13-beta** |
| **Status** | Beta Development Release |
| **Modules** | Foundation · Organization · Master Data · Finance · Sales · Procurement · Inventory · Manufacturing · Quality · CRM · HR · Payroll · Recruitment · Project · Asset · Service · Helpdesk · **Document** |
| **Alembic head** | **`0332_seed_document_workflows`** |
| **Tests** | **241 passed** |
| **Routes** | **1167** FastAPI · **756** OpenAPI · **92** Document · **52** Document OpenAPI |
| **Quality gates** | Alembic · FastAPI · Swagger · OpenAPI · Ruff · MyPy · Pytest — **ALL PASS** |
| **Next** | **Sprint 19 — Governance, Risk & Compliance (GRC)** |
| **Ready for Git Tag** | **`v1.13-beta`** |

---

## 11. Version Timeline

| Version | Date | Scope | Alembic Head | Tests |
|---------|------|--------|--------------|-------|
| **v1.0-alpha** | 2026-07-13 | Sprints 0–5 (Foundation → Sales) | `0055_seed_sales_workflows` | 77 passed |
| **v1.1-beta** | 2026-07-13 | Sprints 0–6 (+ Procurement P2P) | `0077_seed_proc_workflows` | 99 passed |
| **v1.2-beta** | 2026-07-13 | Sprints 0–7 (+ Inventory & Warehouse) | `0094_seed_inv_workflows` | 113 passed |
| **v1.3-beta** | 2026-07-14 | Sprints 0–8 (+ Manufacturing & Production) | `0114_seed_mfg_workflows` | 127 passed |
| **v1.4-beta** | 2026-07-14 | Sprints 0–9 (+ Quality Management) | `0135_seed_qm_workflows` | 146 passed |
| **v1.5-beta** | 2026-07-14 | Sprints 0–10 (+ CRM) | `0156_seed_crm_workflows` | 158 passed |
| **v1.6-beta** | 2026-07-14 | Sprints 0–11 (+ HRMS) | `0178_seed_hr_workflows` | 169 passed |
| **v1.7-beta** | 2026-07-14 | Sprints 0–12 (+ Payroll) | `0200_seed_payroll_workflows` | 179 passed |
| **v1.8-beta** | 2026-07-14 | Sprints 0–13 (+ Recruitment) | `0222_seed_recruitment_workflows` | 189 passed |
| **v1.9-beta** | 2026-07-14 | Sprints 0–14 (+ Project) | `0244_seed_project_workflows` | 199 passed |
| **v1.10-beta** | 2026-07-14 | Sprints 0–15 (+ Asset) | `0266_seed_asset_workflows` | 209 passed |
| **v1.11-beta** | 2026-07-15 | Sprints 0–16 (+ Service) | `0288_seed_service_workflows` | 219 passed |
| **v1.12-beta** | 2026-07-15 | Sprints 0–17 (+ Helpdesk) | `0310_seed_helpdesk_workflows` | 230 passed |
| **v1.13-beta** | 2026-07-15 | Sprints 0–18 (+ Document / DMS) | `0332_seed_document_workflows` | 241 passed |

```text
v1.12-beta ──(+ Sprint 18 Document / DMS)──► v1.13-beta ──► Sprint 19 GRC (planned)
```

| Version | Date | Change |
|---------|------|--------|
| 1.0 | 2026-07-15 | Initial ERP Core v1.13-beta release notes after Sprint 18 validation |

---

**Confirmations**

- `ERP_Core_v1.13-beta.md` created successfully
- Previous release notes remain unchanged
- Ready for Git tag: **`v1.13-beta`**
- Ready to begin Sprint 19 planning

**ERP Core v1.13-beta release documentation completed and ready for release approval.**
