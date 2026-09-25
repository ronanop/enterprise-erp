# CRM Module — Complete Breakdown (Porting Spec)

> **Purpose:** Full context of what is built in this ERP’s CRM so you can rebuild the **same structure, features, and flow** in a **Node.js** app without losing business rules or UX behavior.
>
> **Source of truth in this repo:** `apps/api/src/modules/crm/**`, `apps/web/src/app/(app)/crm/**`, `apps/web/src/services/sales-crm-service.ts`, `docs/02_FRD/FRD-05-CRM-Domain.md`, `docs/06_ERD/ERD_10_CRM.md`, `docs/07_RELEASES/Sales_CRM_Demo_Guide.md`.
>
> **UI entry:** `http://localhost:3003/crm`  
> **API prefix:** `/api/v1/crm`

---

## 0. How to use this document (Node rebuild prompt)

Copy this entire file into your Node project as the module spec. Implement in this order:

1. Schema + code sequences + soft-delete/audit columns  
2. Table-driven **Sales Blueprint** state machine (exact transitions below)  
3. Company → Lead → Opportunity → Quote → OVF services with gates  
4. My Jobs approval inbox + locking  
5. Margin engine + OVF finance-cost formula  
6. REST routes mirroring `/crm/*`  
7. Frontend workspace tabs + deal timeline driven by `allowed_actions`

**Stack mapping (Python ERP → Node):**

| This ERP | Node target |
|----------|-------------|
| FastAPI routers (thin) | Express/Nest/Fastify controllers (thin) |
| Service layer | Service / use-case layer |
| Repository + SQLAlchemy | Repository + Prisma/TypeORM/Knex/pg |
| Pydantic schemas | Zod / class-validator DTOs |
| Alembic | Prisma migrate / Knex / TypeORM migrations |
| Celery stubs | BullMQ / Agenda (optional) |
| Next.js App Router UI | Same routes/components patterns in your Node front (Next/React or separate SPA) |

**Architecture rule (keep identical):**

```text
Router/Controller → Service → Repository → Database
```

No business logic in routers. No direct DB from UI. Soft delete only (no physical DELETE on business tables). UUID PKs. Tenant isolation (`tenant_id`, `company_id`, `branch_id`). Audit columns (`created_at`, `created_by`, `updated_at`, `updated_by`, `version`).

---

## 1. What CRM actually is (two layers)

CRM in this product is **two systems sharing one schema**:

### Layer A — Classic CRM (ERD_10 / FRD-05)

Lead sources, leads, assignments, activities, pipelines, opportunities, stage history, campaigns, interactions, tasks, follow-ups, meetings, call/email/visit logs, customer feedback, satisfaction, reports.

Lifecycle (coarse):

```text
Lead → Qualified → Opportunity → Quotation → Negotiation → Won → Sales Order
                                                         ↘ Lost
```

### Layer B — Sales CRM / Zoho-replacement (primary UI at `/crm`)

Account-centric **sales blueprint** with gated documents and approvals:

```text
Company (Sales Account)
  → Lead (only from Company)
    → Opportunity (only via Lead convert)
      → BOQ / SOW approvals (Presales)
      → Deal Registration
      → OEM quotation
      → Quote (+ margin gates)
      → Customer PO approval (Management)
      → OVF (Order Value Form)
        → Share to SCM
        → Deal Won
```

**Critical:** Blueprint-aware records have `blueprint_state != null`. Legacy records with `blueprint_state IS NULL` keep the old coarse APIs and do **not** run blueprint actions.

---

## 2. Product rules (must preserve in Node)

| # | Rule | Behavior |
|---|------|----------|
| 1 | **Company first** | Lead is created only under a Company: `POST /crm/companies/{id}/leads`. No standalone sales-blueprint lead create. |
| 2 | **Opportunity via convert only** | Sales opportunities created by `POST /crm/leads/{id}/convert`. List UI has no “New Opportunity” for blueprint flow. |
| 3 | **Quote after OEM quote** | Quote create allowed only when opportunity reaches `quote_ready` (`oem_quote_attached = true`). |
| 4 | **OVF after Customer PO approved** | OVF create only when opportunity is `ovf_ready` (`customer_po_approved = true`). |
| 5 | **Lost until Deal Won** | `lost` available on Lead / Opportunity / Quote until terminal won. **No lost on OVF** (PO already approved). |
| 6 | **Margin thresholds** | HW/SW ≥ **7%**; Services ≥ **20%**. Mixed lines use the **stricter** (higher) threshold. Below/at threshold → cannot self-approve; must `send-for-approval` to Management. |
| 7 | **Finance cost on OVF** | `finance_cost_pct = round((max(0, customer_payment_days - vendor_payment_days - 5) / 15) * 0.5, 2)` (5-day buffer, no ceil) |
| 8 | **Locking on approval** | Sending for approval sets `locked = true`. Locked records reject blueprint actions (`409`) except universal `lost` where applicable. Unlock on approve/reject decision. |

---

## 3. Happy-path flow (hardware / standard resale)

```text
[Company] create account (billing address required)
    │
    ▼
[Lead] POST /companies/{id}/leads
    blueprint_state = open
    │
    ├─ lost ──────────────────────────────► terminal lost
    │
    ▼ convert
[Opportunity] blueprint_state = open
    │
    ├─ attach_boq / attach_sow ──────────► boq_pending
    │     send_boq_approval ─────────────► boq_approval (locked)
    │       My Jobs Presales approve ────► approve_boq → deal_reg
    │       reject ──────────────────────► boq_pending
    │     (SOW path parallel: send_sow_approval → sow_approval)
    │
    ├─ deal_reg (deal_reg_number) ───────► oem_pending
    ├─ oem_received ─────────────────────► oem_attached
    ├─ attach_oem_quote ─────────────────► quote_ready
    │
    ├─ create Quote ─────────────────────► quote_in_progress
    │     Quote: draft → send_for_approval → internal_approval
    │            → approved_internal → send_to_customer
    │            → accept → accepted
    │            (opp advances to po_pending on accept)
    │
    ├─ attach_po ────────────────────────► po_pending
    ├─ send_po_approval ─────────────────► po_approval (locked)
    │     My Jobs Management approve ────► approve_po → ovf_ready
    │
    ├─ create OVF ───────────────────────► (opp stays ovf_ready / may mark won path)
    │     OVF: draft → send_for_approval → approval
    │          → approved → share_to_scm → shared_scm
    │          → deal_won ───────────────► Deal Won
    │                                      opp status=won, probability=100%
    └─ lost (any non-terminal) ──────────► lost
```

### Cloud product variant (parallel state machine)

When lead `product_type = cloud`, opportunity gets `cloud_blueprint_variant`:

| Variant | Meaning |
|---------|---------|
| `billing_shift` | Billing shift / FinOps-style |
| `migration` | Migration |
| `poc_assessment` | POC / OLA / MAP assessment |
| `cloud_other` | Other cloud |

Cloud **filters out** hardware pipeline actions (`attach_boq`, `deal_reg`, `oem_received`, `attach_po`, `create_quote`, `create_ovf`, etc.) and uses cloud actions:

```text
open → attach_contract → cloud_docs
     → send_cloud_discount_approval → cloud_discount_approval
         approve → cloud_onboarding | reject → cloud_docs
     (migration may use map_oem_pending → attach_oem_quote | skip)
     → mark_onboarding_done → won
```

Profitability helper:  
`profitability% = distributor_discount% − customer_discount%` (default distributor discount often 11%).

---

## 4. Blueprint state machine (copy exactly)

Source: `apps/api/src/modules/crm/service/engines/sales_blueprint_engine.py`

### Lead

| From | Action | To |
|------|--------|-----|
| `open` | `convert` | `converted` |
| `open` | `lost` | `lost` |
| `converted` / `lost` | — | terminal |

### Opportunity (standard)

| From | Actions → To |
|------|----------------|
| `open` | `attach_boq`/`attach_sow` → `boq_pending`; cloud: `attach_contract` → `cloud_docs`; `lost` |
| `boq_pending` | `attach_*`; `send_boq_approval` → `boq_approval`; `send_sow_approval` → `sow_approval`; gated `deal_reg` → `oem_pending`; `lost` |
| `boq_approval` | `approve_boq` → `deal_reg`; `reject_boq` → `boq_pending`; `lost` |
| `sow_approval` | `approve_sow` → `deal_reg`; `reject_sow` → `boq_pending`; `lost` |
| `sow_optional` (legacy) | `attach_sow`/`skip_sow` → `deal_reg`; `lost` |
| `deal_reg` | `deal_reg` → `oem_pending`; more attach/approve; `lost` |
| `oem_pending` | `oem_received` → `oem_attached`; `lost` |
| `oem_attached` | `attach_oem_quote` → `quote_ready`; `lost` |
| `quote_ready` | `create_quote` → `quote_in_progress`; `lost` |
| `quote_in_progress` | `quote_accepted` → `po_pending`; `lost` |
| `po_pending` | `attach_po`; `send_po_approval` → `po_approval`; `lost` |
| `po_approval` | `approve_po` → `ovf_ready`; `reject_po` → `po_pending`; `lost` |
| `ovf_ready` | `create_ovf`; `deal_won` → `won`; `lost` |
| `won` / `lost` | terminal |

### Quote (`quote_stage` mirrors blueprint)

```text
draft → send_for_approval → internal_approval
      → approve_internally → approved_internal
      → send_to_customer → sent_to_customer
      → negotiate | follow_up | accept | lost
accepted | lost = terminal
```

### OVF

```text
draft → send_for_approval → approval
      → approve → approved
      → share_to_scm → shared_scm
      → deal_won → deal_won
```

**API pattern:**

- `GET /crm/{entity}/{id}/blueprint` → `{ blueprint_state, locked, allowed_actions[] }`
- `POST /crm/opportunities/{id}/actions/{action}` (and quote/ovf equivalents)
- UI **only** renders buttons from `allowed_actions` (never hardcode stages in the client).

---

## 5. Domain entities & code prefixes

Schema: **`crm`**. Table prefix: **`crm_`**.

| Entity | Table | Code prefix | Notes |
|--------|-------|-------------|-------|
| Lead source | `crm_lead_source` | — | Catalog |
| Pipeline | `crm_pipeline` | `PIPE-` | Catalog |
| Campaign | `crm_campaign` | `CMP-` | + `crm_campaign_member` |
| Company (sales account) | `crm_company` | `COMP-` / `ACC-` style account_number | **Not** a duplicate of `master_customer`; optional `master_customer_id` FK |
| Contact | `crm_contact` | — | Linked to company account |
| Product | `crm_product` | `PRD-` | CRM product catalog |
| OEM | `crm_oem` | `OEM-` | Vendor/OEM master |
| Selling entity | `crm_selling_entity` | `ENT-` | Legal selling entities / GST |
| Lead | `crm_lead` | `LEAD-` | Classic + sales extensions |
| Lead assignment | `crm_lead_assignment` | — | |
| Lead activity | `crm_lead_activity` | — | |
| Opportunity | `crm_opportunity` | `OPP-` | |
| Opportunity stage hist | `crm_opportunity_stage` | — | |
| Quote + lines | `crm_quote`, `crm_quote_line` | `QT-` | |
| OVF + lines | `crm_ovf`, `crm_ovf_line` | `OVF-` | Lines have `side`: `customer_po` \| `vendor` |
| Attachment | `crm_attachment` | — | BOQ, SOW, OEM quote, PO, vendor quote, etc. |
| Approval task | `crm_approval_task` | `JOB-` | My Jobs inbox |
| State history | `crm_state_history` | — | Audit trail of blueprint transitions |
| KYC record | `crm_kyc_record` | `KYC-` | Account mapping |
| Task / Followup / Meeting | `crm_task`, `crm_followup`, `crm_meeting` | `TSK-`, `FU-`, `MTG-` | |
| Call / Email / Visit | `crm_call_log`, `crm_email_log`, `crm_visit_log` | — | |
| Interaction | `crm_interaction` | `INT-` | |
| Feedback / CSAT | `crm_customer_feedback`, `crm_customer_satisfaction` | `FBK-` | |
| Saved report | `crm_saved_report` | — | Report builder |

### Lead statuses (classic)

`new` | `assigned` | `contacted` | `qualified` | `unqualified` | `converted` | `lost`

### Opportunity stages / status (classic)

Stages: `qualification` | `discovery` | `proposal` | `negotiation` | `won` | `lost`  
Status: `open` | `won` | `lost` | `cancelled`  
Forecast: `expected_revenue × probability_percent / 100` (computed; no separate forecast table).

### Approval team roles (My Jobs)

`presales` | `project` | `management` | `accounts` | `scm`  
Task statuses: `pending` | `approved` | `rejected` | `cancelled`

---

## 6. Core field model (sales flow)

### Company (`crm_company`)

- Identity: `account_number`, `customer_name`, `industry` (+ `other_industries`), `source`, `status` (`active`/`inactive`)
- People: `first_name`, `last_name`, `customer_email`, `phone`, `website`, owners
- **Billing address required:** street, city, state, code, country  
- Shipping optional (UI: “Copy from billing”)
- Optional link: `master_customer_id`
- Soft flags: `locked`

### Lead (sales extensions on `crm_lead`)

- Must have `company_account_id` for blueprint leads
- `lead_source_id`, `owner_employee_id`, `mobile`, names
- Commercial: `expected_amount`, `committed_amount`, `expected_closure_date`
- Product cascade: `product_type` (`hardware`/`software`/`cloud`/`others`), `sub_product_category`, `sub_product`, `sub_product_other`
- OEM / distributor / entity / end-customer directory fields (used by list directories)
- `blueprint_state`, `locked`, `presales_owner_id`, BANT-ish fields, convert → `converted_opportunity_id`

### Opportunity (sales flags)

Boolean/doc flags driving gates:

- `boq_attached`, `boq_approved`, `sow_attached`, `sow_approved`, `sow_skipped`
- `deal_reg_number`, `oem_quotation_received`, `oem_quote_attached`
- `customer_po_attached`, `customer_po_approved`
- `blueprint_state`, `locked`, `cloud_blueprint_variant`, discount fields for cloud

### Quote

- Header: subject, project, entity block (name/email/address/GST), billing/shipping, freight, AMC
- Lines: `line_type` (`hardware`/`software`/`services`), qty, unit_cost, unit_sell, gst_pct, HSN
- Computed: `grand_total`, `avg_margin_pct`, `total_margin_amount`
- `quote_stage`, `approval_status`, `locked`

### OVF

- Created from `quote_id` (+ `opportunity_id`, `company_account_id`)
- PO meta: `po_number`, `po_date`, `delivery_period`
- Payment: `vendor_payment_days`, `customer_payment_days` → `finance_cost_pct`
- SCM: `shared_to_scm`, hold fields (`scm_on_hold`, history JSON)
- `deal_won`, `deal_won_amount`
- Lines dual-sided: customer PO vs vendor

---

## 7. API surface (Node should mirror)

Base: `/api/v1/crm`

### Classic CRM routers

| Path | Purpose |
|------|---------|
| `/lead-sources` | CRUD catalog |
| `/leads` | CRUD + convert + lost + blueprint |
| `/lead-assignments` | Assignments |
| `/lead-activities` | Activities |
| `/pipelines` | Pipelines |
| `/opportunities` | CRUD + actions + timeline + blueprint |
| `/opportunity-stages` | Stage history |
| `/campaigns`, `/campaign-members` | Campaigns |
| `/interactions` | Touchpoints |
| `/tasks`, `/followups`, `/meetings` | Execution |
| `/call-logs`, `/email-logs`, `/visit-logs` | Channel logs |
| `/customer-feedback`, `/customer-satisfaction` | VoC |
| `/reports` (+ saved reports) | Analytics / report builder |

### Sales CRM routers

| Path | Purpose |
|------|---------|
| `/companies` | Sales accounts; nested `/companies/{id}/leads` |
| `/contacts` | Contacts |
| `/products` | Product catalog |
| `/oems` | OEM master |
| `/selling-entities` | Selling entities |
| `/quotes` + `/quotes/{id}/lines` | Quotes; margin; approve; actions |
| `/ovf` + `/ovf/{id}/lines` | OVF; share-scm; deal-won |
| `/my-jobs` | Approval inbox; `POST /{id}/decide` |
| `/attachments` | File metadata / base64 upload |
| `/kyc-records` | KYC / account mapping |
| `/members` | Module membership |
| Blueprint helpers | `/leads/{id}/blueprint`, `/opportunities/{id}/blueprint`, `/opportunities/{id}/actions/{action}`, quote/ovf equivalents |

### Auth / tenancy

- Bearer JWT (same platform auth)
- All transactional rows scoped by `tenant_id` + `company_id` + usually `branch_id`
- Permission keys like `crm.lead:convert`, `crm.quote:approve`, `crm.ovf:deal_won`, `crm.my_jobs:decide`, `crm.blueprint:act` (see `permissions.py`)

### Demo roles (reference)

| Role | Typical use |
|------|-------------|
| Sales manager | Drive full blueprint |
| Presales | Approve BOQ/SOW |
| Management | Quote margin exceptions, Customer PO, OVF |
| Accounts | Visibility |
| SCM | Post-share OVF / hold |

---

## 8. Frontend workspace (what `/crm` shows)

Standalone CRM chrome: `CrmSidebar` / `CrmWorkspaceNav`.

### Nav tabs (built)

| Tab | Route | Implementation |
|-----|-------|----------------|
| Dashboard | `/crm` | `CrmDashboard` |
| Reports | `/crm/reports` | Saved reports list/builder/view |
| My Jobs | `/crm/my-jobs` | Approval inbox |
| Company | `/crm/companies` | List + detail + new/edit + nested KYC/leads |
| Leads | `/crm/leads` | List + detail + convert/lost |
| Opportunities | `/crm/opportunities` | List (no New) + detail + blueprint actions |
| OEM Quote | `/crm/oem-quotes` | Document registry (`oem_quote`) |
| Quotes | `/crm/quotes` | List + detail/edit + lines + margin UI |
| Purchase Order | `/crm/purchase-orders` | Document registry (`customer_po`) |
| OVF | `/crm/ovf` | List + detail/edit |
| Contacts | `/crm/contacts` | CRUD |
| Products | `/crm/products` | CRUD |
| Meetings | `/crm/meetings` | Meetings list |
| Customer Follow Ups | `/crm/customer-followups` | Follow-ups |
| KYC - Account Mapping | `/crm/kyc-account-mapping` | KYC mapping UI |
| OEM / Distributor / Entity / End Customer | `/crm/oem`, `/distributors`, `/entities`, `/end-customers` | Lead directory filters |
| BOQ / SOW | `/crm/boq`, `/crm/sow` | Document registries |
| Users | `/crm/users` | Module users (if admin) |

Generic fallback: `[resource]` → `ResourceListView` for remaining `modules.ts` CRM resources (campaigns, call-logs, etc.).

### Key UX behaviors to clone

1. **DealTimeline** stepper: Company → Lead → Opportunity → Quote → OVF → Won (labels from stage resolver, not raw state codes).
2. **BlueprintActions** bar: only `allowed_actions` from API.
3. **Locked banner**: red sticky “locked pending approval” + link to My Jobs.
4. **Synced banners**: fields inherited from Company / Opportunity shown read-only with blue sync banner.
5. **Quote reverse margin calculator**: edit Cost / Sell / Margin % → recompute the other two.
6. **Opportunity list**: banner explaining create-only-via-lead-convert.
7. **Company detail**: only place for **Create Lead** (disabled if inactive).
8. PDF export helpers exist for company, lead, quote, OVF (client-side).
9. Dense dashboard / Swiss-minimal ERP chrome (ShadCN + Tailwind); Lucide icons only.

### Frontend file map

```text
apps/web/src/app/(app)/crm/          # routes
apps/web/src/components/crm/         # UI
apps/web/src/services/sales-crm-service.ts
apps/web/src/lib/crm/*               # stage labels, PDF, options
apps/web/src/config/modules.ts       # module + resource registry
```

### Backend file map

```text
apps/api/src/modules/crm/
  router.py                 # aggregates all routers
  routers/                  # thin HTTP
  service/                  # business + blueprint + margin + cloud
  service/engines/          # pure state machines / calculators
  repository/               # persistence
  models/                   # ORM (infra only)
  domain/                   # enums, entities, exceptions
  schemas.py                # Pydantic I/O
  permissions.py
  tasks.py                  # Celery stubs
```

---

## 9. Cross-module boundaries (do not violate)

| Allowed | Forbidden |
|---------|-----------|
| FK read to `master_customer`, `master_employee` | Duplicate customer master inside CRM |
| Optional `master_customer_id` on company/lead/opp | Direct writes to `sales_*`, `fin_*`, `qm_*` |
| UUID refs to sales quotation/order (`sales_quotation_id`) without FK | CRM posting GL journals |
| Workflow / notification / audit via platform engines | Cross-module raw SQL into other schemas |
| Procurement/Project adapters consume CRM via ports | UI talking to DB |

Downstream: Won deal / OVF may feed SCM/procurement; Project has a CRM port; Procurement has a CRM adapter.

---

## 10. My Jobs approval flow

1. Blueprint action needing approval (e.g. `send_boq_approval`, quote `send-for-approval`, `send_po_approval`, OVF `send-for-approval`) creates `CrmApprovalTask` with `team_role`, `entity_type`, `entity_id`, status `pending`.
2. Source record `locked = true`.
3. Approver opens `/crm/my-jobs`, filters by team/status, `POST /my-jobs/{id}/decide` with `{ decision: approved|rejected, remark }`.
4. Service resumes matching blueprint action (`approve_boq`, `approve_internally`, `approve_po`, OVF `approve`, etc.) and unlocks.
5. Reject usually returns to previous editable state and unlocks.
6. Notification stub may set `notification_sent = true` (wire real email/push later).

---

## 11. Margin & finance engines (port these formulas)

### Quote margin

- Per line: margin from cost vs sell.
- Aggregate `avg_margin_pct`, `total_margin_amount`.
- Threshold selection:
  - Only HW/SW lines → 7%
  - Only services → 20%
  - Mixed → max(thresholds of present types) i.e. stricter
- `approve-internally` if margin healthy; else `409` → force Management approval path.

### OVF finance cost

```text
rawGap = customer_payment_days - vendor_payment_days
gapDays = max(0, rawGap - 5)   # 5-day buffer
finance_cost_pct = round((gapDays / 15) * 0.5, 2)
```

---

## 12. Suggested Node module layout

```text
src/modules/crm/
  domain/
    enums.ts
    blueprint-transitions.ts   // copy §4 tables
    exceptions.ts
  repositories/
  services/
    company.service.ts
    lead.service.ts
    opportunity.service.ts
    quote.service.ts
    ovf.service.ts
    approval-task.service.ts
    attachment.service.ts
    margin.engine.ts
    cloud-flow.ts
    blueprint.service.ts
  controllers/ or routes/
  dto/ or schemas/
  permissions.ts
```

Keep the blueprint engine **pure** (no DB) so you can unit-test transitions identically.

---

## 13. UI walkthrough checklist (acceptance)

Use this as QA for the Node rebuild:

- [ ] Create Company with required billing address  
- [ ] Create Lead only from Company detail  
- [ ] Convert Lead → Opportunity (pipeline + remark)  
- [ ] Attach BOQ → send Presales approval → My Jobs approve  
- [ ] Deal Reg → OEM received → Attach OEM quote  
- [ ] Create Quote only after OEM quote attached  
- [ ] Lines + margin calculator; below-threshold forces Management approval  
- [ ] Send to customer → Accept → opp `po_pending`  
- [ ] Attach Customer PO → Management approve → `ovf_ready`  
- [ ] Create OVF → approve → Share SCM → Deal Won (amount required)  
- [ ] Lost works on Lead/Opp/Quote before won; not on OVF  
- [ ] Locked banner + My Jobs round-trip  
- [ ] Cloud lead skips HW BOQ/OEM/PO/Quote/OVF path  

---

## 14. Related docs in this repo

| Doc | Role |
|-----|------|
| `docs/02_FRD/FRD-05-CRM-Domain.md` | Functional requirements (classic CRM) |
| `docs/06_ERD/ERD_10_CRM.md` | Schema / ERD lock (18 classic tables + extensions via later migrations) |
| `docs/07_RELEASES/Sales_CRM_Demo_Guide.md` | End-to-end API + UI demo for sales blueprint |
| Alembic `0136_create_crm_schema` + `0445_crm_sales_process` (+ later CRM revs) | Schema evolution |

---

## 15. One-paragraph “prompt seed” for your Node agent

> Build a modular CRM matching this ERP’s Sales CRM: PostgreSQL schema `crm`, Clean Architecture (controller → service → repository), UUID + soft delete + tenant/company/branch + audit. Implement Company-first leads, lead-only opportunity conversion, and a table-driven sales blueprint state machine for Lead/Opportunity/Quote/OVF with the exact transitions and product rules (#1–#8): OEM-gated quotes, PO-gated OVF, margin thresholds 7%/20%, OVF finance cost formula, approval locking via My Jobs (`presales`/`management`/`scm`/…), universal lost until deal won (no OVF lost), plus a cloud opportunity variant that filters hardware pipeline actions. Expose REST under `/crm/*` and a dense admin UI at `/crm` with tabs (Dashboard, My Jobs, Company, Leads, Opportunities, Quotes, OVF, Contacts, Products, …) where action buttons are driven only by `GET …/blueprint.allowed_actions` and stage labels mirror the deal timeline resolver.

---

*Generated from the Enterprise ERP Platform CRM implementation for Node porting. Keep this file updated if blueprint transitions or product rules change.*
