# Asset Checklist — Migration Notes (FP-ASSET-014)

## Revision

`0479_ast_checklist_governance`

**Down revision:** `0478_ast_service_history_governance`

## Changes

1. `ix_ast_asset_checklist_asset_id` on `(asset_id)` WHERE `is_deleted=false`
2. `ix_ast_asset_checklist_maintenance_id` on `(maintenance_id)` WHERE `is_deleted=false`
3. `ix_ast_asset_checklist_audit_id` on `(audit_id)` WHERE `is_deleted=false`
4. `ix_ast_asset_checklist_company_status` on `(company_id, status)` WHERE `is_deleted=false`
5. `uk_ast_asset_checklist_company_code` unique on `(company_id, checklist_code)` WHERE `is_deleted=false`

## Excluded

- No column changes
- No permission seeds
- No status constraint changes

## Post-migration

- No data backfill required.

## Duplicate `checklist_code` remediation (deployment failure)

`0479` creates partial unique index `uk_ast_asset_checklist_company_code`.  
If **two or more active rows** (`is_deleted=false`) share the same `(company_id, checklist_code)`, `alembic upgrade head` **will fail** with a unique-index violation.

### Detect duplicates (pre-deploy)

```sql
SELECT company_id, checklist_code, COUNT(*) AS row_count
FROM asset.ast_asset_checklist
WHERE is_deleted = false
GROUP BY company_id, checklist_code
HAVING COUNT(*) > 1;
```

### Remediation procedure

1. Stop deployment; do **not** force the migration.
2. For each duplicate group, decide canonical row (usually newest `created_at`).
3. Rename or soft-delete superseded rows so only one active code remains per company.
4. Re-run detection query until zero rows returned.
5. Re-run `alembic upgrade head`.

Example rename pattern:

```sql
UPDATE asset.ast_asset_checklist
SET checklist_code = checklist_code || '-DUP-' || LEFT(id::text, 8),
    updated_at = NOW()
WHERE id IN (/* duplicate row ids to retire */);
```

Soft-delete alternative: set `is_deleted = true` on superseded rows if business approves archival.

## Performance note

Text search uses `ILIKE` on `checklist_code`, `checklist_name`, and joined asset fields.  
For very large tenants, consider a future additive migration with `pg_trgm` GIN indexes — **not in scope for 0479**.
