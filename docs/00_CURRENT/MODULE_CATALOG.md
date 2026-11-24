# Module catalog & primary flows (as built)

**Updated:** 2026-10-08  
**API mount:** `apps/api/src/shared/router.py` → `/api/v1`  
**UI registry:** `apps/web/src/config/modules.ts`

## 1. API modules (registered)

| Module | Package | Notes |
|--------|---------|--------|
| Health / landing | `landing`, health | Public health + marketing landing APIs |
| Platform | `platform` | SLO, metrics, ops status |
| Foundation | `foundation` | Auth, tenants, users, RBAC, workflow, notify, audit, settings |
| Organization | `organization` | Companies, branches, departments, org tree |
| Master data | `master_data` | Employees, customers, vendors, products, tax, party registration |
| Finance | `finance` | COA, journals, GL, AR/AP, tax register, asset postings |
| Sales | `sales` | Quotes, orders, deliveries, invoices, returns |
| Procurement / SCM | `procurement` | PR→RFQ→PO→GRN, contracts, SCM queue, sheet trackers, delivery challan |
| Inventory | `inventory` | Stock, transfers, adjustments, reservations |
| Manufacturing | `manufacturing` | BOM, routings, production orders, issues/receipts |
| Quality | `quality` | Inspections, NCR, CAPA |
| CRM | `crm` | Leads, opportunities, quotes, OVF |
| HR | `hr` | Employment, leave, attendance, separation, ESS policies |
| ESS | `ess` | Employee self-service (leave, attendance, workplace, compliance) |
| Payroll | `payroll` | Runs, payslips, loans, bank export |
| Recruitment | `recruitment` | Requisitions, candidates, onboarding |
| Project | `project` | Projects, WBS, site installation, change requests |
| Asset | `asset` | Register, assignment, transfer, maintenance, disposal, DC challan |
| Service | `service` | Service requests / tickets |
| Helpdesk | `helpdesk` | Ticketing |
| Document | `document` | DMS |
| Marketing | `marketing` | Campaigns / social |
| GRC | `grc` | Compliance, risk, incidents |
| Analytics | `analytics` | BI datasets, dashboards, exports |
| Integration | `integration` | Hub, credentials, webhooks, OAuth clients |
| Ecommerce | `ecommerce` | External channel |
| Portal | `portal` | Customer / supplier portal APIs |
| Voice agent | `voice_agent` | Voice agent helpers |
| Agent read | `agent_read` | Read-only agent query surface |
| MCP | `mcp_server` | MCP bootstrap (mounted from `main`) |

Public routers (unauthenticated or token-gated): digital onboarding, order tracking, project tracking.

## 2. UI groups

| Group | Modules (href keys) |
|-------|---------------------|
| Foundation | foundation, email, voice-agent |
| Organization | organization |
| Master data | master-data |
| Operations | finance, sales, procurement, inventory, manufacturing, quality, crm, hr, payroll, recruitment, project, asset, service, helpdesk, document, marketing, grc, analytics, integration, ecommerce, portal |

ESS is primarily the employee-app / `/ess` surface, backed by `ess` + `hr` APIs.

## 3. Critical business flows

### 3.1 Procure-to-pay (simplified)

```text
Requisition → (workflow) → RFQ / Vendor quote → PO → GRN
        → stock via IInventoryStock → AP invoice → Finance payment
```

Approvals resolve through module governance → `resolve_workflow_definition_id`
(policy matrix + tenant setting override + default provision).

### 3.2 Order-to-cash

```text
CRM lead / opportunity → Quotation → Sales order → Delivery → Invoice
        → AR / journal posting via IFinancePosting
```

### 3.3 Inventory movement

```text
Reservation / transfer / adjustment / GRN / issue
        → InventoryStockAdapter → stock ledger
        → optional outbox domain.inventory.* → AnaInventoryMovementFact
```

### 3.4 Hire-to-retire

```text
Recruitment → Master employee → HR employment / leave / attendance
        → ESS self-service → Separation → F&F via payroll port
```

Master employee writes from other modules go through `EmployeeCommands`
or `EmployeeService`; reads use `EmployeeRead` published projection.

### 3.5 Asset lifecycle

```text
Register → Assignment / Transfer → Maintenance → Disposal / Revaluation
DC challan ↔ SCM (see docs/09_OPS/dc-challan-scm-contract.md)
```

### 3.6 Platform side effects

```text
Service action
  ├─ number via SSOT numbering
  ├─ start workflow if APPROVAL_POLICIES mode=workflow
  ├─ enqueue outbox (notify / audit / finance / integration / domain)
  └─ Celery drain → adapters → projections
```

### 3.7 Service sourcing → SCM → Projects

When a lead has **Services** selected, the **Service Sourcing Channel**
(`Outsourced` | `Cache Service`, stored in lead `deal_type` JSON) copies to
`crm_opportunity.service_sourcing_channel` on convert.

On CRM customer-PO **Management approve** (`approve_po` → `ovf_ready`):

```text
Opportunity (has_services + accepted quote service lines)
  ├─ Outsourced      → proc_order_header order_kind=vendor_service
  │                      → SCM Accept PO → Management issue
  │                      → vendor fulfillment (awaiting_vendor_send)
  └─ Cache Service   → proc_order_header order_kind=internal_service
                         (vendor = setting scm.internal_service_vendor_id)
                         → SCM Accept PO → Management issue
                         → auto-share to Projects PO Queue
                         → PM Create Project (manual)
```

Product/hardware OVF → vendor product PO is unchanged and can run in parallel.
Service POs use `source_document_type=opportunity_service`.

## 4. Cross-module rules (enforced)

1. **No foreign ORM** outside `adapters/` / `ports/` (CI gate).  
2. **Master data:** read via `modules.master_data.published`; write via owner commands/services.  
3. **Finance & stock:** one posting path and one stock path (platform adapters).  
4. **Notify / audit:** prefer platform facades.  
5. **Secrets / PII:** encrypted column types; never log plaintext.

## 5. Where to change things

| Change | Location |
|--------|----------|
| New API route | Module `routers/` → thin → service |
| New permission | Module `permissions.py` (+ migration seed if needed) |
| New approval doc type | `platform/policies.py` + module `WORKFLOW_CODES` |
| New Celery beat job | Module `tasks.py` + `workers/celery_app.py` schedule; wrap with `system_job` if side-effecting |
| New UI module card | `apps/web/src/config/modules.ts` + app route |
| Schema | Alembic revision only |
