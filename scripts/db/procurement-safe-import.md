# Safe Procurement Data Import

Use this guide to load **procurement sample PO data** from a full ERP backup **without** affecting CRM, projects, or Entra users.

## Before you start

1. **Back up your database**

   ```bash
   pg_dump -U postgres -d YOUR_DB -F c -f erp_before_procurement.dump
   ```

2. **Apply schema migrations** (adds procurement tables + OVF hold columns only — no data overwrite)

   ```bash
   cd apps/api
   alembic upgrade head
   ```

3. **Grant procurement access to your Entra user** (Organization → Users → assign `procurement` module + `BUYER` role). Do **not** import demo users from the backup.

## What to import

| Import | Skip |
|--------|------|
| `procurement.proc_order_header` | `crm.*` |
| `procurement.proc_order_line` | `project.*` |
| `procurement.proc_order_receipt_batch*` | `foundation.sec_user` |
| `procurement.proc_inventory_stock_unit` | `master.master_employee` |
| Optional: `procurement.proc_grn_*`, `proc_invoice_*` | Full backup restore |

## Get your live IDs

Run on **your** database (not the backup):

```sql
SELECT id, code FROM foundation.sec_tenant;
SELECT id, company_code FROM organization.org_company;
SELECT id, branch_code FROM organization.org_branch;
SELECT id, email FROM foundation.sec_user WHERE email = 'your-entra-email@company.com';
```

## Remap backup values

Backup demo context (replace everywhere in procurement INSERTs):

| Field | Backup value |
|-------|----------------|
| `tenant_id` | `d3dab809-e72f-4bfe-b8f7-9f2762491187` |
| `company_id` | `6c9d6227-4e00-4a49-adc2-f1255ff79aa7` |
| `branch_id` | `b1f6bc81-4049-49d1-b387-5e931dd323b3` |

Also remap:

- `vendor_id` → match `master.master_vendor` by name in your DB
- `product_id` / `uom_id` on PO lines → your `master_product` / `master_uom`
- `created_by` / `updated_by` → your Entra `sec_user.id` or `NULL`

`source_document_id` (OVF UUID) can stay as-is — it is not a foreign key.

## Extract procurement INSERTs from backup (PowerShell)

```powershell
$backup = "C:\Users\Moksh sharma\Downloads\erp_full_backup_20260811_115330.sql"
Select-String -Path $backup -Pattern "^INSERT INTO procurement\." |
  ForEach-Object { $_.Line } |
  Set-Content ".\procurement_inserts_raw.sql"
```

Edit `procurement_inserts_raw.sql` to replace tenant/company/branch/vendor/product/uom/user UUIDs.

## Apply in a transaction

```sql
BEGIN;
\i procurement_inserts_remapped.sql
-- verify
SELECT document_number, status, company_po_number
FROM procurement.proc_order_header ORDER BY document_date;
-- CRM / projects unchanged
SELECT COUNT(*) FROM crm.crm_opportunity;
SELECT COUNT(*) FROM project.prj_project;
COMMIT;  -- or ROLLBACK;
```

## SCM queue without CRM import

- **Vendor PO list** (`/procurement/vendor-po`) works with procurement data only.
- **SCM queue** (`/procurement/scm`) needs OVFs in your live CRM with `shared_to_scm = true` — use **Share to SCM** on approved OVFs; do not import backup CRM rows.

## Verify app

1. Log in with Entra user (procurement module assigned)
2. `/procurement` — dashboard
3. `/procurement/scm` — queue (after sharing OVF from CRM)
4. `/procurement/orders` — imported POs
5. Confirm `/crm` and `/projects` unchanged
