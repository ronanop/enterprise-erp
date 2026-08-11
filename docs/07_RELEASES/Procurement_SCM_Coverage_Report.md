# Procurement & Supply Chain — Coverage Report

| Field | Value |
|-------|--------|
| **Document type** | Module coverage & completion checklist |
| **Scope** | Procurement (`FRD-07`) + Supply Chain workspace (SCM, delivery, procurement inventory) |
| **Baseline** | `docs/02_FRD/FRD-07-Procurement-Domain.md`, `docs/06_ERD/ERD_06_Procurement.md`, codebase `apps/api/src/modules/procurement`, `apps/web/src/components/procurement` |
| **Last reviewed** | 2026-08-06 |

---

## 1. How to read this report

Percentages are **product readiness** estimates (not line-of-code), using four lenses:

| Lens | Weight | Meaning |
|------|--------|---------|
| **Backend (API + services)** | 25% | Routers, services, models, migrations, permissions |
| **Frontend (dedicated UI)** | 30% | Custom pages vs generic `ResourceListView` only |
| **End-to-end workflow** | 35% | Real user path from CRM/sales handoff through PO → receipt → payables |
| **FRD extras** | 10% | Workflow engine, finance posting, notifications, reports, UAT criteria |

**Status labels**

- ✅ **Complete** — Usable in production-style demos; gaps are polish or edge cases  
- 🟡 **Partial** — Core path works; missing FRD items or UI depth  
- 🔵 **API only** — Backend exists; little or no product UI  
- ⬜ **Not started / stub** — Schema or placeholder only  

---

## 2. Executive summary

### 2.1 Your five focus areas

| Area | Overall % | Status | Notes |
|------|-----------|--------|--------|
| **Purchase orders (POs)** | **~82%** | 🟡 Partial → strong | SCM + CRM-sourced POs, draft/finalize, PDF, company PO numbers, order detail receipts |
| **GRNs** | **~78%** | 🟡 Partial | Primary path = **order line receipts + receipt batches** (SCM); classic `proc_grn_*` API exists but UI is receipt-centric |
| **Vendor invoices** | **~55%** | 🟡 Split | **Receipt-batch vendor invoice** (~72%) vs **AP `proc_invoice`** module (~35%) |
| **Contracts** | **~40%** | 🔵 API only | CRUD + lines API; no dedicated contract workspace UI |
| **SCM** | **~85%** | ✅ Complete (beta) | OVF queue, view OVF, create/hold PO, freight/finance edits, CRM handoff |

**Average of the five (simple mean): ~72%**

Interpretation: **Supply chain execution (SCM → PO → GRN/receipt)** is the most complete strip. **Classic procure-to-pay tail** (formal AP invoices, contracts, PR/RFQ) lags behind.

### 2.2 Supply chain workspace (product surface)

| Strip | Overall % | Status |
|-------|-----------|--------|
| SCM (CRM OVF → vendor PO) | ~85% | ✅ |
| Purchase orders | ~82% | 🟡 |
| GRNs / goods receipt | ~78% | 🟡 |
| Delivery challan | ~55% | 🟡 |
| Delivery status | ~55% | 🟡 |
| Procurement inventory | ~78% | 🟡 |
| Vendors (master in workspace) | ~78% | 🟡 |

**Supply chain workspace mean (SCM + delivery + inventory + vendors): ~73%**

### 2.3 Full procurement module (all `modules.ts` resources)

Includes upstream **requisitions, RFQs, vendor quotations, comparisons, returns, performance** — mostly API with generic list UI.

| Category | Overall % |
|----------|-----------|
| **Downstream (PO → receipt → payables)** | ~70% |
| **Upstream (PR → RFQ → quote → PO)** | ~35% |
| **Governance (contracts, performance)** | ~35% |
| **Whole procurement module (weighted)** | **~58%** |

---

## 3. Master checklist — procurement module resources

Source: `apps/web/src/config/modules.ts` (`key: "procurement"`).

| # | Resource key | Title | Backend | UI | E2E | FRD extras | **Overall %** | Status |
|---|--------------|-------|---------|-----|-----|------------|---------------|--------|
| 1 | `scm` | SCM Queue | 90% | 85% | 80% | 70% | **85%** | ✅ |
| 2 | `orders` | Purchase Orders | 85% | 85% | 80% | 65% | **82%** | 🟡 |
| 3 | `grns` | GRNs | 80% | 80% | 75% | 60% | **78%** | 🟡 |
| 4 | `delivery-challan` | Delivery Challan | 45% | 70% | 60% | 40% | **55%** | 🟡 |
| 5 | `delivery-status` | Delivery Status | 45% | 70% | 55% | 40% | **55%** | 🟡 |
| 6 | `inventory` | Inventory (procurement tab) | 85% | 80% | 70% | 55% | **78%** | 🟡 |
| 7 | `vendors` | Vendors | 80% | 80% | 75% | 60% | **78%** | 🟡 |
| 8 | `invoices` | Vendor Invoices (AP) | 75% | 20% | 25% | 50% | **35%** | 🔵 |
| 9 | `contracts` | Contracts | 70% | 25% | 30% | 45% | **40%** | 🔵 |
| 10 | `requisitions` | Requisitions | 70% | 15% | 20% | 40% | **35%** | 🔵 |
| 11 | `rfqs` | RFQs | 70% | 15% | 20% | 40% | **35%** | 🔵 |
| 12 | `vendor-quotations` | Vendor Quotations | 70% | 15% | 20% | 40% | **35%** | 🔵 |
| 13 | `comparisons` | Comparisons | 65% | 15% | 15% | 35% | **32%** | 🔵 |
| 14 | `returns` | Returns | 65% | 15% | 20% | 45% | **35%** | 🔵 |
| 15 | `performance` | Vendor Performance | 60% | 15% | 15% | 35% | **30%** | 🔵 |

**Dedicated UI routes** (`apps/web/src/app/(app)/procurement/[resource]/page.tsx`): `scm`, `orders`, `vendor-po`, `grns`, `delivery-challan`, `delivery-status`, `vendors`, `inventory`.  
**Generic API list only**: requisitions, rfqs, vendor-quotations, comparisons, invoices, returns, contracts, performance.

---

## 4. Supply chain — detailed checklist (what is properly completed)

### 4.1 SCM — CRM OVF handoff ✅ (~85%)

| Item | Done | Evidence |
|------|------|----------|
| List shared OVFs (SCM queue) | ✅ | `scm_handoff_service.list_scm_queue`, `scm-queue-page.tsx` |
| OVF preview for SCM | ✅ | `get_ovf_preview`, `scm-ovf-view-page.tsx` |
| Hold / unhold OVF without PO | ✅ | `holdScmOvf`, SCM API |
| SCM edit freight / additional / finance % | ✅ | `updateScmOvfCharges`, CRM sync |
| Create vendor PO from OVF | ✅ | `create_po_from_ovf`, `scm-create-po-page.tsx` |
| Finalize (issue) PO | ✅ | `finalize_scm_order` |
| Company PO numbering (entity codes) | ✅ | `company_po_number_service`, peek next PO |
| CRM dependency (share OVF only) | ✅ | `OvfService.get_scm_handoff`, `shared_to_scm` gate |
| Open / Close / Hold queue KPIs & filters | ✅ | `scm-queue-page.tsx` |

| Item | Not done / partial | |
|------|-------------------|---|
| Full workflow engine on SCM PO | 🟡 | Draft/finalize; not full FRD PO approval matrix |
| Automated notifications to SCM | 🟡 | Dashboard poll / banners; not full notification engine |

---

### 4.2 Purchase orders 🟡 (~82%)

| Item | Done | Evidence |
|------|------|----------|
| List POs with GRN status enrichment | ✅ | `orders-list-page.tsx`, `order_service` |
| PO detail (lines, commercial, CRM OVF context) | ✅ | `order-detail-page.tsx` |
| Create PO (SCM path) | ✅ | SCM create PO flow |
| Create PO from inventory | ✅ | `create_po_from_inventory`, inventory dialog |
| PO PDF download | ✅ | `purchase-order-pdf` utilities |
| Orders Excel export | ✅ | `orders-excel-export`, API route |
| Draft vs issued vs cancelled | ✅ | Status on `proc_order_header` |
| Link to source OVF (`source_module=crm`) | ✅ | Order headers from SCM |

| Item | Not done / partial | |
|------|-------------------|---|
| Classic PO create from PR/RFQ/contract | 🟡 | API exists; UI not primary |
| PO approval workflows (FRD §15) | 🟡 | Permissions + some actions; not full My Jobs parity |
| Contract-priced PO lines | ⬜ | `contract_id` on model; weak UI linkage |

---

### 4.3 GRNs / goods receipt 🟡 (~78%)

| Item | Done | Evidence |
|------|------|----------|
| Receive against PO lines (partial qty, serials) | ✅ | `update_line_receipt`, `receipt-serials-dialog.tsx` |
| Receipt batches (GRN numbers per receipt) | ✅ | `proc_order_receipt_batch`, `list_receipt_batches` |
| GRN copy PDF | ✅ | `goods-receipt-pdf.ts` |
| GRN list UI (receipt POs, partial/closed) | ✅ | `grns-list-page.tsx` (vendor-pos + GRN status) |
| Receipt history & batch picker | ✅ | `grn-receipt-history-dialog`, `grn-pdf-pick-dialog` |
| Billing quantity on receipt lines | ✅ | Partial billing for inventory rollups |
| Stock summary on GRN page | ✅ | `grn-stock-summary-table.tsx` |

| Item | Not done / partial | |
|------|-------------------|---|
| Classic `proc_grn_header` document UI | 🔵 | `GrnService` + `/procurement/grns` API; UI uses SCM receipts |
| Full inventory module stock ledger (Sprint 7) | 🟡 | Procurement inventory derived from receipts; `inv_*` not full WMS |
| Incoming QC (FRD-14) | ⬜ | Optional on GRN line in ERD; not in SCM UI |

---

### 4.4 Vendor invoices 🟡 (~55% combined)

#### A) Receipt-batch vendor invoice (operational) ~72%

| Item | Done | Evidence |
|------|------|----------|
| Attach vendor invoice file to receipt batch | ✅ | `attach_receipt_batch_document` |
| Extract fields from PDF (number, date, qty, subtotal) | ✅ | `extract_vendor_invoice`, `vendor_invoice_extract` |
| Save vendor invoice fields on batch | ✅ | `update_receipt_batch_vendor_invoice` |
| UI on PO receipt flow | ✅ | `receipt-serials-dialog.tsx`, order detail |
| Display in GRN history / pick dialogs | ✅ | `grn-receipt-history-dialog.tsx` |

#### B) AP purchase invoices (`proc_invoice`) ~35%

| Item | Done | Evidence |
|------|------|----------|
| CRUD + list API | ✅ | `invoices_router`, `InvoiceService` |
| Post to finance (AP journal) | ✅ | `ProcurementPostingService.post_invoice` |
| Dedicated invoice workspace UI | ⬜ | Generic `ResourceListView` only |
| Create invoice from GRN/PO in UI | ⬜ | Not wired in procurement workspace |
| Dashboard “recent vendor invoices” | 🟡 | Overview loads API; shallow widget |

---

### 4.5 Vendor contracts 🔵 (~40%)

| Item | Done | Evidence |
|------|------|----------|
| Contract header + lines API | ✅ | `contracts_router`, `ContractService` |
| Workflow actions (submit/approve) | 🟡 | Service engines; UI not exposed |
| PO link `contract_id` | 🟡 | Model/FK in ERD |
| Contract management UI | ⬜ | Generic list at `/procurement/contracts` |
| Contract compliance on PO pricing | ⬜ | FRD §11 not productized in SCM PO |

---

### 4.6 Delivery (supply chain extension) 🟡 (~55%)

| Item | Done | Evidence |
|------|------|----------|
| Delivery challan create/edit/view | ✅ | `delivery-challan-form-page.tsx`, local persistence |
| Challan PDF | ✅ | `delivery-challan-pdf.ts` |
| Delivery status list / update modals | ✅ | `delivery-status-list-page.tsx` |
| Link challan to PO / GRN context | 🟡 | Client-side storage + routes |
| Server-backed delivery API | 🔵 | Reminder/dispatch API routes; not full backend domain |
| Finance / logistics integration | ⬜ | Not in FRD-07 core tables |

---

### 4.7 Procurement inventory 🟡 (~78%)

| Item | Done | Evidence |
|------|------|----------|
| List stock units from GRN receipts | ✅ | `list_procurement_inventory` |
| Import inventory lines | ✅ | `import_procurement_inventory` |
| Create PO from inventory | ✅ | `procurement-inventory-create-po-dialog.tsx` |
| Non-billed stock reporting | ✅ | `procurement-inventory-report` utils |
| Explicit stock ledger table | 🟡 | Migration/repair history; rollups receipt-based |

---

### 4.8 Upstream procure-to-pay (not supply chain, but procurement module) 🔵 (~35%)

| Module | API | UI | Notes |
|--------|-----|-----|--------|
| Requisitions | ✅ | ⬜ | `requisitions_router`, generic list |
| RFQs | ✅ | ⬜ | `rfqs_router` |
| Vendor quotations | ✅ | ⬜ | `vendor_quotations_router` |
| Vendor comparison | ✅ | ⬜ | `comparisons_router` |
| Purchase returns | ✅ | ⬜ | `returns_router`, posting service for returns |
| Vendor performance | 🟡 | ⬜ | `performance_router` |

---

## 5. Backend router map (reference)

`apps/api/src/modules/procurement/router.py` mounts:

| Router | Prefix | Primary use today |
|--------|--------|-------------------|
| `scm_router` | `/procurement/scm` | **SCM + receipts + inventory import** |
| `orders_router` | `/procurement/orders` | PO CRUD + workflow |
| `grns_router` | `/procurement/grns` | Classic GRN documents |
| `invoices_router` | `/procurement/invoices` | AP vendor invoices |
| `contracts_router` | `/procurement/contracts` | Vendor contracts |
| `requisitions_router` | `/procurement/requisitions` | PR |
| `rfqs_router` | `/procurement/rfqs` | RFQ |
| `vendor_quotations_router` | `/procurement/vendor-quotations` | Quotes |
| `comparisons_router` | `/procurement/comparisons` | Compare |
| `returns_router` | `/procurement/returns` | Returns |
| `performance_router` | `/procurement/performance` | Scorecards |

---

## 6. What is **properly completed** (sign-off list)

Use this as a demo / UAT “green” list for **Supply Chain + Procurement operations**:

- [x] CRM Sales: OVF approved → Share to SCM  
- [x] SCM Queue: open / close / hold, search, refresh  
- [x] View OVF in SCM (commercial, addresses, margin, customer PO meta)  
- [x] Create vendor PO from OVF (draft)  
- [x] Finalize PO (issued) with company PO number  
- [x] Hold OVF without vendor (SCM on hold)  
- [x] Purchase Orders list: filters, GRN status, export, PDF  
- [x] PO detail: receive goods (partial), serials, billing qty  
- [x] Receipt batches: GRN numbers, history, GRN copy PDF  
- [x] Vendor invoice on receipt: upload, extract, save fields  
- [x] GRNs page: receipt PO list, stock summary, challan menu  
- [x] Delivery challan + delivery status (client workflow)  
- [x] Procurement inventory: list, import, create PO from stock  
- [x] Vendors: list, add/edit in workspace  

**Not yet “properly completed” for full FRD-07:**

- [ ] End-to-end **AP vendor invoice** UI (create from GRN → approve → post)  
- [ ] **Vendor contracts** UI and PO pricing from contract  
- [ ] **PR → RFQ → vendor quote → PO** UI chain  
- [ ] Full **workflow / My Jobs** parity for procurement documents  
- [ ] **Procurement reports** (FRD §21)  
- [ ] **Inventory module** (`/inventory`) as system of record vs procurement-derived stock  

---

## 7. Recommended next milestones (priority)

1. **Vendor invoices (AP)** — Dedicated UI + GRN/PO → invoice creation (~+15% on module).  
2. **Contracts** — Workspace UI + optional link on SCM create PO (~+8%).  
3. **Unify GRN story** — Either promote classic GRN docs or document SCM receipts as canonical (~clarity).  
4. **Upstream P2P** — One guided PR→RFQ→PO path (~+10% module).  
5. **Server-backed delivery** — Replace or sync local challan storage (~+5% supply chain).

---

## 8. Document history

| Date | Change |
|------|--------|
| 2026-08-06 | Initial coverage report (procurement + supply chain workspace) |

---

*Percentages are estimates for planning; update this file when major features ship or FRD scope changes.*
