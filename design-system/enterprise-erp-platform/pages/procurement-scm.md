# Procurement SCM Page Overrides

> **PROJECT:** Enterprise ERP Platform
> **Page Type:** SCM workspace (OVF queue → vendor PO → GRN)
> Rules override `MASTER.md` and extend `procurement.md`.

---

## Page-Specific Rules

### Layout Overrides

- **Structure:** App shell + procurement workspace nav → SCM pages
- **Screens:** SCM Queue · Create PO from OVF · Vendor POs · Order detail + GRN
- **Density:** High (9/10) — dense tables, compact KPI strip
- Sky accent `#0369A1` for SCM primary actions (matches MASTER accent)

### Color Overrides

- GRN badges: pending amber · partial sky · delivered/closed emerald
- Gate-locked rows: muted until OVF shared + no PO yet
- No purple gradients; light shell only

### Component Overrides

- Queue table: OVF #, customer, vendor total, PO status, Create PO CTA
- PO editor: vendor select, vendor lines (read-only from OVF), Draft / Finalize
- Vendor-PO list: document #, vendor, amount, GRN badge, line expand
- GRN modal/inline: pending → partial → delivered + qty received

### Section Order (SCM Queue)

1. Page header (Refresh)
2. KPI strip (awaiting PO / with PO / vendor total)
3. Approved OVF table

### Avoid

- Marketing hero / configurator patterns
- Re-implementing Sales/Finance workspaces here (CRM owns those gates)
