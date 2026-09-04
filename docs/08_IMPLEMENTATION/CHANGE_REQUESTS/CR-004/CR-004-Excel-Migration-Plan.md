# CR-004 — Excel Migration Plan

**Phase:** 4.1 — Architecture (execution in Phase 7 per roadmap)  
**Principle:** One-time **load** into existing tables; no parallel Excel database  
**Prerequisites:** Phase 5 assignment enrichment; stable `operational_status` backfill rules

---

## 1. Objectives

| Objective | Success measure |
|-----------|-----------------|
| Retire daily Excel operations | IT Admin uses inventory + assignment modules |
| Preserve history | Prior holders and issue dates importable |
| Branch accuracy | Noida / Mumbai / Dubai counts match sign-off |
| Auditability | No silent overwrite; import batch auditable |

---

## 2. Migration scope

### In scope

- Employee Asset Register sheet (primary grid)
- Bucket classification per row (tab name or status column)
- Active assignments (employee + issue date + challan/remarks when columns exist)
- Asset identity (tag, name, serial)
- Branch
- Accessories text → components where parseable
- Discovery-friendly configuration columns → `discovery_profile_json` (allowlisted keys only)

### Out of scope (v1 import)

- Workflow instance recreation
- Finance cost / depreciation backfill unless separate workstream
- Automated ongoing sync from Excel
- Multi-sheet formula logic

---

## 3. Source template (logical columns)

Align import template to **ownership matrix** (`CR-004-Phase-4.1-Excel-Gap-Analysis.md`):

| Column | Required | Maps to |
|--------|----------|---------|
| Asset Tag | Yes | `ast_asset.asset_code` |
| Laptop Name | Yes | `ast_asset.asset_name` |
| Branch | Yes | `branch_id` lookup |
| Excel Tab / Status | Yes | `operational_status` |
| Employee ID | If assigned | `master_employee` → `assignment.employee_id` |
| Issue Date | If assigned | `assignment.allocated_at` |
| Delivery Challan | No | `delivery_challan_ref` (Phase 5) |
| Remarks | No | `assignment.remarks` |
| Serial | No | `serial_number` |
| Manufacturer / Model / CPU / RAM | No | discovery JSON or product link |
| Charger / Other Items | No | component rows or skip |
| Earlier Used By | No | **Do not import** — recompute from history after load |

---

## 4. Migration phases

### Phase A — Prepare (with 4.1 analysis)

- [x] Lock ownership matrix
- [ ] Customer signs column mapping
- [ ] Freeze Excel version (file hash, date)
- [ ] Master data ready: employees, branches, categories

### Phase B — Enrichment (roadmap Phase 5)

- [ ] Alembic: `delivery_challan_ref`, `remarks` on `ast_asset_assignment`
- [ ] API + Assignment UI
- [ ] Return condition on API + UI

### Phase C — Tooling (roadmap Phase 7)

| Deliverable | Description |
|-------------|-------------|
| `import_it_register` script | Idempotent batch loader (CLI or admin command) |
| Validation report | Row-level errors CSV |
| Dry-run mode | No commit; counts only |
| Reconciliation | Ops status vs active assignment |

### Phase D — Execution

1. **Dry-run** on copy of production DB (staging).
2. Fix master data gaps (unknown employee IDs, branch typos).
3. **Production import** in maintenance window.
4. Reconciliation job + manual spot checks (sample 50 rows).
5. **Excel freeze** — read-only archive.

### Phase E — Hypercare (2 weeks)

- Daily bucket count comparison (dashboard vs Excel archive)
- Assignment corrections via ERP only
- Log defects as data repair tickets, not Excel edits

---

## 5. Row processing algorithm (logical)

```text
FOR each Excel row:
  RESOLVE asset by asset_code (or create if policy allows)
  SET branch_id, asset_name, serial, discovery fields (allowlist)
  MAP tab → operational_status
  IF tab == Assigned OR employee_id present:
      ENSURE no other active assignment on asset
      CREATE assignment (active) with employee_id, allocated_at, challan, remarks
      SET operational_status = ASSIGNED
  ELSE IF tab == Ready To Move:
      ENSURE no active assignment
      SET operational_status = READY_TO_MOVE
  ELSE IF tab == Not Given To Anyone:
      SET operational_status = RETIRED
  ELSE IF tab == Not Working:
      SET operational_status = PENDING_DISPOSAL
  ELSE IF tab == Disposed:
      SET operational_status = DISPOSED; align lifecycle disposed
  PARSE accessories → ast_asset_component (optional)
COMMIT batch
RUN reconciliation
```

**Historical issues:** Optional second sheet or inferred from “Earlier Used By” is **discouraged**; prefer separate **Assignment History** export if customer maintains log.

---

## 6. Validation rules

| Rule | Severity |
|------|----------|
| Duplicate `asset_code` in file | Error |
| Assigned row without Employee ID | Error |
| Unknown Employee ID | Error (or warning + skip row — policy) |
| Active assignment + non-ASSIGNED ops status | Error |
| ASSIGNED ops without active assignment | Error |
| RETIRED/DISPOSED with active assignment | Error |
| Branch not in {Noida, Mumbai, Dubai} | Error |
| Issue date in future | Warning |

---

## 7. Reconciliation

| Check | Action |
|-------|--------|
| Count by `operational_status` per branch | Compare to Excel pivot |
| Active assignments = ASSIGNED assets | Auto-report mismatches |
| `custodian_employee_id` vs active `employee_id` | Repair script |
| Sample 50: tag, holder, issue date, tab | Manual sign-off |

Existing roadmap item: **reconciliation job** (Phase 7).

---

## 8. Rollback

| Scenario | Response |
|----------|----------|
| Dry-run failure | Fix source file; no DB change |
| Post-import critical errors | Restore DB snapshot; resume Excel until fix |
| Partial row errors | Skip rows in import; fix forward in ERP |

Import batch id stored in audit metadata for traceability (design in Phase 7).

---

## 9. Dependencies

| Dependency | Owner |
|------------|--------|
| Phase 5 schema | Backend |
| Employee master completeness | HR / Master Data |
| Branch master | Organization |
| IT asset category | CR-001 categories |
| Inventory UI for verification | Phase 3.4 (done) |

---

## 10. Risks

| Risk | Mitigation |
|------|------------|
| Wrong ops status on bulk load | Dry-run + reconciliation |
| Duplicate assignments | Validator + import pre-check |
| Name stored instead of employee id | Import rejects non-ID formats |
| Excel formulas hidden columns | Customer exports **values only** |

See `CR-004-Risks.md`.

---

## 11. Deliverables checklist (Phase 7 implementation)

- [ ] Import specification (this doc + column appendix)
- [ ] Python import command under `apps/api/scripts/` (future)
- [ ] Unit tests for mapping functions
- [ ] Runbook for IT Admin
- [ ] Sign-off template (counts by branch × bucket)

---

## 12. References

- `CR-004-Phase-4.1-Excel-Gap-Analysis.md`
- `CR-004-Assignment-Data-Model.md`
- `CR-004-Assignment-Workflow.md`
- `CR-004-Implementation-Roadmap.md` (Phase 7)
