# Sales CRM (Zoho-Replacement) — Demo Guide

Migration: `0445_crm_sales_process` · Schema: `crm`

This guide walks the full happy-path sales blueprint end to end using the
REST API: **Company → Lead → Opportunity (BOQ → SOW → Deal Reg → OEM → Quote
→ Customer PO → OVF → Deal Won)**. It matches the acceptance criteria in the
product brief and exercises every product rule (#1–#8).

All requests are prefixed with `API_V1_PREFIX = /api/v1`. Examples below use
`curl` syntax — on Windows, run them from Git Bash / WSL, or use `curl.exe`
explicitly inside PowerShell (the built-in `curl` alias is `Invoke-WebRequest`
and does not accept the same flags).

## 0. Setup

```bash
cd apps/api

# 1) Base tenant / org / module users (skip if already seeded)
.venv/Scripts/python.exe -m scripts.seed_demo_data

# 2) Sales CRM team users, demo products, "Calipers Consulting" account
.venv/Scripts/python.exe -m scripts.seed_sales_crm_demo
```

This creates/refreshes four team-role logins (password **`Secure1!`** for all):

| Email | Role | Purpose in the demo |
|---|---|---|
| `sales.user@example.com` | `CRM_SALES_MANAGER` | Drives the whole flow: creates the account, lead, converts, attaches docs, creates quote/OVF |
| `presales.user@example.com` | `CRM_PRESALES` | Approves the BOQ ("Send for approval to Presales") |
| `management.user@example.com` | `CRM_MANAGEMENT` | Approves Customer PO, quote margin exceptions, and OVF |
| `accounts.user@example.com` | `CRM_ACCOUNTS` | Read-only visibility into quotes/OVF (Accounts team) |

`sales.user@example.com` also already exists as the generic Sales-module
demo admin (from `seed_demo_data.py`) — the script simply layers the
`CRM_SALES_MANAGER` role and permissions onto it, so no credentials change.

It also prints the seeded product IDs and the `Calipers Consulting`
`crm_company` id — grab that id from the script output (`Sales account : ACC-... (id=...)`)
before continuing, or fetch it again with step 2 below.

## 1. Log in

```bash
BASE=http://localhost:8000/api/v1

TOKEN=$(curl -s -X POST $BASE/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email":"sales.user@example.com","password":"Secure1!"}' \
  | jq -r '.data.access_token')
```

All subsequent requests send `-H "Authorization: Bearer $TOKEN"`.

## 2. Company first (Rule #1)

Fetch the seeded demo account, or create a new one:

```bash
# Find it
curl -s $BASE/crm/companies -H "Authorization: Bearer $TOKEN" | jq '.data[] | {id, customer_name}'

COMPANY_ACCOUNT_ID=<id from above>

# ...or create a fresh one
curl -s -X POST $BASE/crm/companies -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" -d '{
    "branch_id": "<HQ branch id>",
    "customer_name": "Acme Robotics Pvt Ltd",
    "industry": "Manufacturing",
    "source": "referral",
    "billing_street": "1 Factory Road", "billing_city": "Pune",
    "billing_state": "MH", "billing_code": "411001", "billing_country": "India"
  }'
```

A **Lead can only be created from a Company** — there is no standalone
`POST /crm/leads` path for the sales blueprint. You'll need a
`lead_source_id` (`GET /crm/lead-sources`) and an `owner_employee_id`
(`GET /master-data/employees`) — both are pre-seeded by `seed_demo_modules.py`
for the demo company:

```bash
LEAD_SOURCE_ID=$(curl -s "$BASE/crm/lead-sources" -H "Authorization: Bearer $TOKEN" | jq -r '.data[0].id')
OWNER_EMPLOYEE_ID=$(curl -s "$BASE/master-data/employees" -H "Authorization: Bearer $TOKEN" | jq -r '.data[0].id')

curl -s -X POST $BASE/crm/companies/$COMPANY_ACCOUNT_ID/leads \
  -H "Authorization: Bearer $TOKEN" -H "Content-Type: application/json" -d '{
    "branch_id": "<HQ branch id>",
    "lead_source_id": "'"$LEAD_SOURCE_ID"'",
    "owner_employee_id": "'"$OWNER_EMPLOYEE_ID"'",
    "expected_amount": 500000,
    "product_type": "hardware"
  }'
```

Response `blueprint_state` = `"open"`. Save `LEAD_ID`.

## 3. Convert Lead → Opportunity (Rule #2)

Opportunities in the sales blueprint can **only** be created through lead
conversion — there is no direct "create opportunity" path for this flow.

```bash
PIPELINE_ID=$(curl -s "$BASE/crm/pipelines" -H "Authorization: Bearer $TOKEN" | jq -r '.data[0].id')

curl -s -X POST $BASE/crm/leads/$LEAD_ID/convert \
  -H "Authorization: Bearer $TOKEN" -H "Content-Type: application/json" -d '{
    "pipeline_id": "'"$PIPELINE_ID"'",
    "opportunity_name": "Acme Robotics — Server Refresh",
    "expected_revenue": 500000,
    "remark": "Qualified after site visit"
  }'
```

Save `OPPORTUNITY_ID` from the response. `blueprint_state` = `"open"`.

## 4. BOQ → Presales approval (Rules #6/#8)

```bash
# Attach BOQ (metadata-only demo upload — provide file_path or content_base64)
curl -s -X POST $BASE/crm/opportunities/$OPPORTUNITY_ID/actions/attach_boq \
  -H "Authorization: Bearer $TOKEN" -H "Content-Type: application/json" \
  -d '{"file_name":"boq-v1.pdf","file_path":"/uploads/boq-v1.pdf","content_type":"application/pdf"}'
# state -> boq_pending

# Send for approval to Presales — locks the opportunity + creates a My Jobs task
curl -s -X POST $BASE/crm/opportunities/$OPPORTUNITY_ID/actions/send_boq_approval \
  -H "Authorization: Bearer $TOKEN" -H "Content-Type: application/json" \
  -d '{"team_role":"presales","remarks":"Please review BOQ pricing"}'
# state -> boq_approval, locked = true
```

Switch to the Presales user and decide the job:

```bash
PRESALES_TOKEN=$(curl -s -X POST $BASE/auth/login -H "Content-Type: application/json" \
  -d '{"email":"presales.user@example.com","password":"Secure1!"}' | jq -r '.data.access_token')

TASK_ID=$(curl -s "$BASE/crm/my-jobs?team_role=presales&status=pending" \
  -H "Authorization: Bearer $PRESALES_TOKEN" | jq -r '.data[0].id')

curl -s -X POST $BASE/crm/my-jobs/$TASK_ID/decide \
  -H "Authorization: Bearer $PRESALES_TOKEN" -H "Content-Type: application/json" \
  -d '{"decision":"approved","remark":"Pricing looks good"}'
```

Deciding "approved" automatically resumes the opportunity blueprint
(`approve_boq`) and unlocks it — `blueprint_state` -> `sow_optional`.

## 5. SOW (optional) → Deal Registration → OEM

Back on `sales.user@example.com`:

```bash
# Skip SOW for this deal
curl -s -X POST $BASE/crm/opportunities/$OPPORTUNITY_ID/actions/skip_sow \
  -H "Authorization: Bearer $TOKEN" -H "Content-Type: application/json" -d '{}'
# state -> deal_reg

curl -s -X POST $BASE/crm/opportunities/$OPPORTUNITY_ID/actions/deal_reg \
  -H "Authorization: Bearer $TOKEN" -H "Content-Type: application/json" \
  -d '{"deal_reg_number":"DR-2026-0001"}'
# state -> oem_pending

curl -s -X POST $BASE/crm/opportunities/$OPPORTUNITY_ID/actions/oem_received \
  -H "Authorization: Bearer $TOKEN" -H "Content-Type: application/json" -d '{}'
# state -> oem_attached

curl -s -X POST $BASE/crm/opportunities/$OPPORTUNITY_ID/actions/attach_oem_quote \
  -H "Authorization: Bearer $TOKEN" -H "Content-Type: application/json" \
  -d '{"file_name":"oem-quote.pdf","file_path":"/uploads/oem-quote.pdf"}'
# state -> quote_ready  (oem_quote_attached = true)
```

## 6. Quote — only after OEM quote attached (Rule #3)

```bash
QUOTE_ID=$(curl -s -X POST $BASE/crm/quotes \
  -H "Authorization: Bearer $TOKEN" -H "Content-Type: application/json" -d '{
    "opportunity_id": "'"$OPPORTUNITY_ID"'",
    "branch_id": "<HQ branch id>",
    "subject": "Server Refresh Quote",
    "freight": 5000
  }' | jq -r '.data.id')
# opportunity blueprint_state -> quote_in_progress

# Add lines (product ids from the demo seed, or omit product_id and set product_name)
curl -s -X POST $BASE/crm/quotes/$QUOTE_ID/lines \
  -H "Authorization: Bearer $TOKEN" -H "Content-Type: application/json" -d '{
    "product_name": "Enterprise Server Rack Unit", "line_type": "hardware",
    "qty": 2, "unit_cost": 150000, "unit_sell": 185000, "gst_pct": 18
  }'

curl -s -X POST $BASE/crm/quotes/$QUOTE_ID/lines \
  -H "Authorization: Bearer $TOKEN" -H "Content-Type: application/json" -d '{
    "product_name": "Implementation & Onboarding Services", "line_type": "services",
    "qty": 1, "unit_cost": 70000, "unit_sell": 95000, "gst_pct": 18
  }'

# Check margin (HW/SW >= 7%, Services >= 20%, mixed lines take the stricter bound)
curl -s $BASE/crm/quotes/$QUOTE_ID/margin -H "Authorization: Bearer $TOKEN" | jq
```

**If margin is healthy** (above the required threshold):

```bash
curl -s -X POST $BASE/crm/quotes/$QUOTE_ID/approve-internally \
  -H "Authorization: Bearer $TOKEN" -H "Content-Type: application/json" -d '{}'
```

**If margin is at/below the threshold**, `approve-internally` is rejected —
send it to Management instead (Rule #6 + #8):

```bash
curl -s -X POST $BASE/crm/quotes/$QUOTE_ID/send-for-approval \
  -H "Authorization: Bearer $TOKEN" -H "Content-Type: application/json" \
  -d '{"team_role":"management","remarks":"Margin below threshold — please review"}'
# quote locked + My Jobs task created for Management

MGMT_TOKEN=$(curl -s -X POST $BASE/auth/login -H "Content-Type: application/json" \
  -d '{"email":"management.user@example.com","password":"Secure1!"}' | jq -r '.data.access_token')
TASK_ID=$(curl -s "$BASE/crm/my-jobs?team_role=management&status=pending" \
  -H "Authorization: Bearer $MGMT_TOKEN" | jq -r '.data[0].id')
curl -s -X POST $BASE/crm/my-jobs/$TASK_ID/decide \
  -H "Authorization: Bearer $MGMT_TOKEN" -H "Content-Type: application/json" \
  -d '{"decision":"approved","remark":"Approved despite thin margin — strategic account"}'
```

Then move it to the customer and close it out:

```bash
curl -s -X POST $BASE/crm/quotes/$QUOTE_ID/actions/send_to_customer \
  -H "Authorization: Bearer $TOKEN" -H "Content-Type: application/json" -d '{}'

curl -s -X POST $BASE/crm/quotes/$QUOTE_ID/actions/accept \
  -H "Authorization: Bearer $TOKEN" -H "Content-Type: application/json" \
  -d '{"remark":"Customer accepted over email"}'
# opportunity blueprint_state -> po_pending
```

## 7. Customer PO → Management approval (Rules #4/#8)

```bash
curl -s -X POST $BASE/crm/opportunities/$OPPORTUNITY_ID/actions/attach_po \
  -H "Authorization: Bearer $TOKEN" -H "Content-Type: application/json" \
  -d '{"file_name":"customer-po.pdf","file_path":"/uploads/customer-po.pdf"}'
# customer_po_attached = true

curl -s -X POST $BASE/crm/opportunities/$OPPORTUNITY_ID/actions/send_po_approval \
  -H "Authorization: Bearer $TOKEN" -H "Content-Type: application/json" \
  -d '{"team_role":"management","remarks":"Please approve customer PO"}'
# state -> po_approval, locked = true

TASK_ID=$(curl -s "$BASE/crm/my-jobs?team_role=management&status=pending&entity_type=opportunity" \
  -H "Authorization: Bearer $MGMT_TOKEN" | jq -r '.data[0].id')
curl -s -X POST $BASE/crm/my-jobs/$TASK_ID/decide \
  -H "Authorization: Bearer $MGMT_TOKEN" -H "Content-Type: application/json" \
  -d '{"decision":"approved"}'
# resumes approve_po -> customer_po_approved = true, state -> ovf_ready, unlocked
```

## 8. OVF — only after customer PO approved (Rule #4)

```bash
OVF_ID=$(curl -s -X POST $BASE/crm/ovf \
  -H "Authorization: Bearer $TOKEN" -H "Content-Type: application/json" -d '{
    "quote_id": "'"$QUOTE_ID"'",
    "branch_id": "<HQ branch id>",
    "po_number": "PO-ACME-9931",
    "delivery_period": "4 weeks",
    "vendor_payment_days": 30,
    "customer_payment_days": 45
  }' | jq -r '.data.id')
# finance_cost_pct auto-computed (~0.5% per 15-day gap, Rule #7)
# opportunity blueprint_state -> won  (create_ovf transition)

curl -s -X POST $BASE/crm/ovf/$OVF_ID/lines \
  -H "Authorization: Bearer $TOKEN" -H "Content-Type: application/json" -d '{
    "side":"customer_po","product_name":"Enterprise Server Rack Unit","qty":2,"unit_price":185000
  }'
curl -s -X POST $BASE/crm/ovf/$OVF_ID/lines \
  -H "Authorization: Bearer $TOKEN" -H "Content-Type: application/json" -d '{
    "side":"vendor","product_name":"Enterprise Server Rack Unit","qty":2,"unit_price":150000
  }'

# Send for Management approval
curl -s -X POST $BASE/crm/ovf/$OVF_ID/send-for-approval \
  -H "Authorization: Bearer $TOKEN" -H "Content-Type: application/json" \
  -d '{"team_role":"management","remarks":"Please approve OVF"}'

TASK_ID=$(curl -s "$BASE/crm/my-jobs?team_role=management&status=pending&entity_type=ovf" \
  -H "Authorization: Bearer $MGMT_TOKEN" | jq -r '.data[0].id')
curl -s -X POST $BASE/crm/my-jobs/$TASK_ID/decide \
  -H "Authorization: Bearer $MGMT_TOKEN" -H "Content-Type: application/json" \
  -d '{"decision":"approved"}'
# ovf blueprint_state -> approved, unlocked
```

## 9. Share to SCM → Deal Won

```bash
curl -s -X POST $BASE/crm/ovf/$OVF_ID/share-to-scm -H "Authorization: Bearer $TOKEN"
# ovf blueprint_state -> shared_scm

curl -s -X POST $BASE/crm/ovf/$OVF_ID/deal-won \
  -H "Authorization: Bearer $TOKEN" -H "Content-Type: application/json" \
  -d '{"deal_won_amount": 465000}'
# ovf blueprint_state -> deal_won
# opportunity blueprint_state -> won, status -> won, probability -> 100%
```

Verify the full trail:

```bash
curl -s $BASE/crm/opportunities/$OPPORTUNITY_ID/blueprint -H "Authorization: Bearer $TOKEN" | jq
# allowed_actions == [] (terminal state)
```

## Lost is available until Deal Won (Rule #5)

At any point before the OVF is marked `deal_won`, the deal can be lost from
the Lead, Opportunity, or Quote:

```bash
curl -s -X POST $BASE/crm/leads/$LEAD_ID/lost -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" -d '{"reason":"Budget freeze"}'

curl -s -X POST $BASE/crm/opportunities/$OPPORTUNITY_ID/actions/lost -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" -d '{"reason":"Lost to competitor"}'

curl -s -X POST $BASE/crm/quotes/$QUOTE_ID/actions/lost -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" -d '{"remark":"Customer went with a competitor"}'
```

There is no "lost" action on OVF — by the time an OVF exists, the deal is
already contractually committed (Customer PO approved).

## Reference — endpoints added

| Area | Base path |
|---|---|
| Sales Accounts | `/crm/companies` |
| Contacts | `/crm/contacts` |
| Product catalog | `/crm/products` |
| Quotes + lines | `/crm/quotes`, `/crm/quotes/{id}/lines`, `/crm/quotes/lines/{id}` |
| OVF + lines | `/crm/ovf`, `/crm/ovf/{id}/lines` |
| My Jobs (approvals) | `/crm/my-jobs` |
| Attachments | `/crm/attachments` |
| Blueprint state + actions | `/crm/leads/{id}/blueprint`, `/crm/opportunities/{id}/blueprint`, `/crm/opportunities/{id}/actions/{action}`, `/crm/quotes/{id}/blueprint`, `/crm/ovf/{id}/blueprint`, `/crm/ovf/{id}/actions/{action}` |

All existing legacy CRM endpoints (`/crm/leads`, `/crm/opportunities`, etc.)
are untouched and continue to work for non-blueprint records
(`blueprint_state IS NULL`).

## Notes

- **Margin thresholds** (Rule #6): Hardware/Software lines require ≥7%
  margin, Services lines require ≥20%. A quote with mixed line types is
  held to the *stricter* (higher) of the thresholds present. At or below the
  threshold, `approve-internally` is rejected with a `409`, and the quote
  must be routed to Management via `send-for-approval`.
- **Finance cost** (Rule #7): `finance_cost_pct` on the OVF is computed as
  `ceil(max(0, customer_payment_days - vendor_payment_days) / 15) * 0.5%`.
- **Locking** (Rule #8): any record sent for approval is `locked = true`
  until the approving team decides; locked records reject further blueprint
  actions (`409 Record Locked`) except the universal `lost` action.
- **Notification stub**: `CrmApprovalTask.notification_sent` is set `true`
  synchronously when a job is created — this is a stand-in for the real
  Notification Engine integration, not a functional email/push send.

## 10. Frontend UI Demo

The Sales CRM has a dedicated teamspace at `apps/web/src/app/(app)/crm`,
built with Next.js App Router + TypeScript + Tailwind + ShadCN, matching the
Finance module's dense-dashboard patterns (`PageHeader`, `FinanceField`
forms, `FinanceStatusBadge`, `ConfirmDialog`). Sign in as `sales.user@example.com`
/ `Secure1!` (or the Presales / Management / Accounts logins above to try
the approval side) and open **CRM** in the left nav.

### Teamspace tabs

`My Jobs | Company | Leads | Opportunities | Quotes | OVF | Contacts | Products | Calls | KYC`
(Calls and KYC are stubbed — "coming soon" placeholders; every other tab is
fully wired to the live `/crm/*` API surface above.)

### Walking the blueprint in the UI

1. **Company** → *New Company* → fill Account Info + Billing Address
   (required) → *Copy from Billing* can pre-fill Shipping → Save. Open the
   company's detail page — it is the **only** place with a *Create Lead*
   button. Active companies can create multiple leads; the button is disabled
   only when the account is inactive.
2. **Create Lead** → the form prefills from the company (name, email,
   billing address) inside a "Synced from Company" banner; pick a product
   type (Hardware / Software / Others — Others reveals a free-text field),
   Lead Source, and Owner, then submit.
3. **Lead detail** → shows the Company → Lead → Opportunity → Quote → OVF →
   Won stepper (`DealTimeline`) with the current stage highlighted →
   *Convert to Opportunity* (remark required) or *Mark Lost* (available
   from any non-terminal state, exits the blueprint).
4. **Opportunity detail** → blueprint action buttons render dynamically from
   the `/blueprint` API's `allowed_actions` (Attach BOQ → Send to Pre-sales →
   Attach SOW/Skip → Deal Registration → OEM Quotation Received → Attach OEM
   Quote → *Create Quote* becomes available → Attach Customer PO → Send to
   Accounts/Management → *Create OVF* becomes available after a Quote is
   accepted). The Quotes/OVF tables on this page show empty-state copy
   explaining each gate (e.g. "Create Quote after the OEM quote is
   attached…"). **Opportunities has no "New" button** on its list — a banner
   explains they can only be created by converting a Lead.
5. **Quote detail** → GST/HSN-aware line table with a reverse margin
   calculator (edit Cost, Sell, or Margin % and the other two recompute);
   attach a Vendor Quote before *Send for Approval* (a soft warning banner
   nudges this); *Approve Internally* is gated server-side by the margin
   threshold (≥7% HW/SW, ≥20% Services) — if the margin is at/below
   threshold it 409s and you must use *Send for Approval* instead, which
   raises a My Jobs task for Management.
6. **OVF detail** → add Customer-PO-side and Vendor-side lines to see the
   margin/finance-cost roll up; *Send for Approval* → *Share to SCM* →
   *Mark Deal Won* forces a Deal Won Amount prompt and flips the parent
   Opportunity to `won` (100% probability) — the `DealTimeline` shows "Won".
7. **My Jobs** → the team inbox: filter by team (Presales / Project /
   Management / Accounts / SCM) and status, *Approve* or *Reject* with a
   remark (remark is required to reject), which resumes the originating
   blueprint transition and unlocks the record.
8. **Locked records** show a sticky red "locked pending approval" banner
   with a *Go to My Jobs* shortcut anywhere a record is awaiting a decision.

### Frontend reference

| Area | Component |
|---|---|
| Nav | `apps/web/src/components/crm/crm-workspace-nav.tsx` |
| API wrappers | `apps/web/src/services/sales-crm-service.ts` |
| Shared blueprint UI | `apps/web/src/components/crm/sales/{deal-timeline,blueprint-actions,approval-banner,attachments-panel}.tsx` |
| Company / Contacts / Products | `apps/web/src/components/crm/sales/{company-*,contacts-list-page,products-list-page}.tsx` |
| Lead / Opportunity | `apps/web/src/components/crm/sales/{lead-*,opportunity-*}.tsx` |
| Quote / OVF | `apps/web/src/components/crm/sales/{quote-*,ovf-*}.tsx` |
| My Jobs | `apps/web/src/components/crm/sales/my-jobs-page.tsx` |
| Routes | `apps/web/src/app/(app)/crm/**` (`[resource]/page.tsx` special-cases each sales tab; `companies|leads|opportunities|quotes|ovf/[row_id]/page.tsx` are the detail routes) |

## 10. Frontend UI demo (`apps/web`)

The same happy-path flow above is fully click-driven in the web app under
the **CRM** workspace (`/crm`). Log in as `sales.user@example.com` /
`Secure1!` and use the CRM teamspace tabs:

**My Jobs · Company · Leads · Opportunities · Quotes · OVF · Contacts ·
Products · Calls (stub) · KYC (stub)**

| Step | Where | What to do |
|---|---|---|
| 1. Create/open account | **Company** → list → row or "New Company" | 2-col Account Info + billing/shipping address form (billing required, "Copy to shipping" button) + Description. The company detail page is the **only** place with a "Create Lead" button; active companies can create multiple leads, and inactive accounts keep the button disabled. |
| 2. Create lead | Company detail → **Create Lead** | Pre-fills company/branch; pick Lead Source + Owner; product cascade (Hardware / Software / Others free-text). |
| 3. Convert or lose | **Leads** → lead detail | Deal timeline stepper (Company → Lead → Opportunity → Quote → OVF → Won). "Convert to Opportunity" opens a dialog requiring Pipeline + remark; "Mark Lost" is available until Won. |
| 4. Run the opportunity blueprint | **Opportunities** → opportunity detail (no "New" button on the list — banner explains conversion is Lead-only) | Blueprint action bar renders only the buttons allowed by `GET .../blueprint` (Attach BOQ → Send to Pre-sales → SOW/Skip → Deal Reg → OEM Received → Attach OEM Quote → **Create Quote** (gated, only appears once OEM quote is attached) → …→ Attach PO → Send to Accounts/Management → **Create OVF** (gated on accepted quote) → Deal Won). "Lost" stays available until Won. File-based actions open a small file picker and upload as base64 via the Attachments API. |
| 5. Approve as another role | **My Jobs** | Inbox of pending/approved/rejected tasks, filterable by team and status; Approve/Reject buttons open a remark dialog (remark required to reject) and deep-link back to the source record. |
| 6. Build the quote | **Quotes** → quote detail | GST/HSN-aware line table with a **reverse margin calculator** — edit any of Cost / Sell / Margin % and the other two recompute automatically before saving. An amber banner requires the vendor quote to be attached before Send-for-Approval/Approve-Internally; a second banner explains when the margin is at/below threshold and directs you to "Send for Approval" instead of "Approve Internally". Stage actions: Send for Approval → Approve Internally → Send to Customer → Accept/Negotiate/Follow-up → Lost. |
| 7. Order Value Form | **OVF** → OVF detail (only reachable once the opportunity is `ovf_ready`, i.e. customer PO approved) | Customer-PO vs Vendor line tables, finance-cost %, Send for Approval → Approve → Share to SCM → **Deal Won** (forces a Deal Won Amount prompt in the action dialog). |
| 8. Housekeeping | **Contacts**, **Products** | Simple CRUD lists with a create/edit dialog. |
| — | **Calls**, **KYC** | Stub "coming soon" pages reserved for a future release. |

UX conventions used throughout the new screens:

- A sticky red "locked pending approval" banner with a **Go to My Jobs**
  link appears on any record awaiting a decision.
- Blue "Synced from Company/Opportunity" banners mark fields that are
  read-only because they were copied from a parent record.
- All currency is formatted as `₹` with Indian digit grouping
  (`formatInr` / `formatInrPrecise` in `services/sales-crm-service.ts`).
- Gated empty states spell out the exact condition to unlock the next
  step (e.g. "Create Quote after the OEM quote is attached").
