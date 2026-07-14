# ERP Core v1.4-beta — Release Notes

| Field | Value |
|-------|--------|
| **Document Type** | Enterprise Release Notes |
| **Release Name** | ERP Core v1.4-beta |
| **Release Status** | Beta Development Release |
| **Architecture Lock** | v1.1 — Maintained |
| **Prepared As** | Enterprise Solution Architect · ERP Product Architect · Technical Documentation Lead · Release Manager · Principal Software Engineer |
| **Classification** | Internal — Confidential |
| **Predecessor** | [ERP Core v1.3-beta](./ERP_Core_v1.3-beta.md) |
| **Ready For** | Sprint 10 — CRM (Customer Relationship Management) |

---

## 1. Release Information

| Field | Value |
|-------|--------|
| **Version** | ERP Core v1.4-beta |
| **Status** | Beta Development Release |
| **Date** | 2026-07-14 |
| **Previous Release** | ERP Core v1.3-beta |
| **Architecture Lock** | v1.1 — Preserved |
| **Recommended Git Tag** | `v1.4-beta` |

---

## 2. Sprint 9 Highlights

Sprint 9 delivered the **Quality Management** domain (FRD-14 / ERD_09) as the enterprise QC, NCR/CAPA, audit, and scorecard layer — without owning inventory stock mutation or finance ledger writes.

| Capability | Delivery |
|------------|----------|
| **Quality Module** | `apps/api/src/modules/quality/` — Clean Architecture package (domain, models, repositories, engines, services, routers, adapters, tasks) |
| **Inspection Plans** | Sampling plans, inspection plans, quality characteristics, defect types |
| **Incoming Inspection** | Header + lines; complete / approve; disposition hooks |
| **In-Process Inspection** | Manufacturing-linked in-process QC lifecycle |
| **Final Inspection** | Submit / approve / complete release path |
| **Defects · NCR · CAPA** | Defects, NCR approval, CAPA with root cause / corrective / preventive actions |
| **Supplier Quality** | Supplier quality scorecards with publish lifecycle |
| **Customer Complaints** | Complaint intake through closure |
| **Quality Audits** | Planned → start → complete → close |
| **Quality Scores** | KPI / score publish |
| **Engines (12)** | InspectionPlan · Sampling · Incoming · InProcess · Final · Defect · NCR · CAPA · SupplierQuality · Complaint · Audit · QualityScore |

**Supporting delivered items:** document numbering, Celery jobs (inspection failed alerts, CAPA overdue, audit due, score refresh, finance / inventory disposition retry), RBAC roles (`QUALITY_*`), and six quality approval workflows (`QM_*`).

---

## 3. Quality Management Module

| Item | Value |
|------|--------|
| **Schema** | `quality` |
| **Prefix** | `qm_` |
| **Business Tables** | **18** |
| **ERD** | ERD_09 Quality (locked) |
| **FRD** | FRD-14 Quality Management Domain |

**Tables:** `qm_sampling_plan`, `qm_defect_type`, `qm_inspection_plan`, `qm_quality_characteristic`, `qm_incoming_inspection`, `qm_incoming_inspection_line`, `qm_inprocess_inspection`, `qm_final_inspection`, `qm_defect`, `qm_ncr`, `qm_capa`, `qm_root_cause`, `qm_corrective_action`, `qm_preventive_action`, `qm_supplier_quality`, `qm_customer_complaint`, `qm_quality_audit`, `qm_quality_score`.

**API mount:** `/quality` — plans, sampling, characteristics, defect types, incoming / in-process / final inspections, defects, NCRs, CAPAs, supplier quality, complaints, audits, scores, reports.

---

## 4. Cross Module Integrations

Quality **never** writes `inv_*` tables and **never** writes finance tables directly. Cross-module references use UUID + `source_module` (no FKs to `inv_*` / `proc_*` / `mfg_*` / `sales_*`).

| Module | Integration |
|--------|-------------|
| **Procurement** | Incoming inspection may reference GRN / PO UUIDs for supplier lot QC disposition |
| **Inventory** | `QualityInventoryAdapter` → `InventoryApplicationService` only (`source_module=quality`); quarantine / release / reject via `quality_status` |
| **Manufacturing** | In-process / final inspection may reference production order / receipt UUIDs for shop-floor QC |
| **Finance** | `QualityPostingService` → **`PostingService.post_system_journal`** only (quality cost / scrap / warranty patterns) |
| **Foundation** | **Workflow** (`QM_INCOMING_DISPOSITION`, `QM_FINAL_RELEASE`, `QM_NCR_APPROVAL`, `QM_CAPA_APPROVAL`, `QM_AUDIT_CLOSURE`, `QM_COMPLAINT_CLOSURE`); **Audit** on quality events; **RBAC** (`quality.*` permissions; roles `QUALITY_INSPECTOR`, `QUALITY_ENGINEER`, `QUALITY_MANAGER`, `QUALITY_AUDITOR` with `status='active'`) |

---

## 5. APIs

| Metric | Value |
|--------|------:|
| **Total Routes** | **445** |
| **OpenAPI Paths** | **310** |
| **Quality Routes** | **71** |
| **Quality OpenAPI Paths** | **55** |

Swagger (`/docs`) and OpenAPI (`/openapi.json`) both return **200**; Quality APIs are visible under `/api/v1/quality/*`.

---

## 6. Database

| Item | Value |
|------|--------|
| **Alembic Head** | `0135_seed_qm_workflows` |
| **Migration range (this release delta)** | `0115_create_quality_schema` → `0135_seed_qm_workflows` |
| **Approximate business tables** | Approximately **131** (~113 at v1.3-beta + 18 quality) |
| **Schemas** | `foundation`, `audit`, `config`, `organization`, `master`, `finance`, `sales`, `procurement`, `inventory`, `manufacturing`, **`quality`** (**11**) |

---

## 7. Quality Gates

| Gate | Status |
|------|--------|
| **Alembic Upgrade** | **PASS** — head `0135_seed_qm_workflows` |
| **FastAPI Startup** | **PASS** — Application startup complete |
| **Swagger** | **PASS** (`/docs` 200) |
| **OpenAPI** | **PASS** (`/openapi.json` 200) |
| **Ruff** | **PASS** |
| **MyPy** | **PASS** |
| **Pytest** | **PASS (146)** |

Validation confirmed head `0135_seed_qm_workflows`, successful application startup, `/docs` and OpenAPI generation, and Quality routes registered.

---

## 8. Architecture Status

| Principle | Confirmation |
|-----------|--------------|
| **Architecture Lock v1.1** | **Preserved** — no Architecture Lock changes |
| **No redesign** | Prior sprints unmodified except required integration wiring (`SourceModule.QUALITY`, router / Celery / Alembic env registration) |
| **Clean Architecture** | Router → Service → Repository → Database maintained |
| **DDD** | Quality domain enums, exceptions, entities, value objects, engines |
| **Modular Monolith** | New `modules/quality` package; no service-boundary redesign |

Stack unchanged: FastAPI · SQLAlchemy 2.0 · Alembic · PostgreSQL · Redis · Celery.

---

## 9. Sprint 10 Roadmap

| Attribute | Value |
|-----------|--------|
| **Next Release** | ERP Core **v1.5-beta** (planned) |
| **Sprint** | **Sprint 10 — CRM (Customer Relationship Management)** |
| **Primary FRD** | FRD-05 CRM Domain |

**Expected focus:** leads, opportunities, activities, and customer relationship workflows integrating with Sales and Master Data customer masters — without redesigning Architecture Lock v1.1.

---

## 10. Release Summary

| Item | Confirmation |
|------|----------------|
| Release document | `docs/07_RELEASES/ERP_Core_v1.4-beta.md` |
| Prior releases unmodified | `ERP_Core_v1.0-alpha.md` · `v1.1-beta` · `v1.2-beta` · `v1.3-beta` unchanged |
| **Version** | **ERP Core v1.4-beta** |
| **Status** | Beta Development Release |
| **Modules** | Foundation · Organization · Master Data · Finance · Sales · Procurement · Inventory · Manufacturing · **Quality** |
| **Alembic head** | **`0135_seed_qm_workflows`** |
| **Tests** | **146 passed** |
| **Routes** | **445** FastAPI · **310** OpenAPI · **71** Quality · **55** Quality OpenAPI |
| **Quality gates** | Alembic · FastAPI · Swagger · OpenAPI · Ruff · MyPy · Pytest — **ALL PASS** |
| **Next** | **Sprint 10 — CRM (Customer Relationship Management)** |
| **Ready for Git Tag** | **`v1.4-beta`** |

### Version Timeline

| Version | Date | Scope | Alembic Head | Tests |
|---------|------|--------|--------------|-------|
| **v1.0-alpha** | 2026-07-13 | Sprints 0–5 (Foundation → Sales) | `0055_seed_sales_workflows` | 77 passed |
| **v1.1-beta** | 2026-07-13 | Sprints 0–6 (+ Procurement P2P) | `0077_seed_proc_workflows` | 99 passed |
| **v1.2-beta** | 2026-07-13 | Sprints 0–7 (+ Inventory & Warehouse) | `0094_seed_inv_workflows` | 113 passed |
| **v1.3-beta** | 2026-07-14 | Sprints 0–8 (+ Manufacturing & Production) | `0114_seed_mfg_workflows` | 127 passed |
| **v1.4-beta** | 2026-07-14 | Sprints 0–9 (+ Quality Management) | `0135_seed_qm_workflows` | 146 passed |

```text
v1.3-beta ──(+ Sprint 9 Quality)──► v1.4-beta ──► Sprint 10 CRM (planned)
```

**ERP Core v1.4-beta release documentation completed and ready for release approval.**
