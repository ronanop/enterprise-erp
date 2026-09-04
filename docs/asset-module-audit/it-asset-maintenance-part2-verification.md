# IT Assets — Maintenance: Part 2 Verification Report

**Date:** 2026-08-31  
**Scope:** Simplified maintenance UX (auto-draft, Start Maintenance orchestration, register + drawer, open-WO blocking, reason/duration fields).

## Design choices (as implemented)

| Decision | Choice | Rationale |
|----------|--------|-----------|
| Backend entry points | Extended existing `create` + added `POST /quick-draft` and `POST /{id}/start-maintenance` | Reuses `MaintenanceService.create/update/submit/approve/start` with minimal duplication; quick-draft is a thin wrapper for inventory navigation |
| Expected return date | **Computed on read** (`AssetMaintenanceResponse.expected_return_date` via Pydantic `@computed_field`: `scheduled_date + expected_duration_days`) | Avoids redundant stored column and drift if either input changes; both source fields are persisted |

---

## Verification checklist

| # | Requirement | Result | Proof |
|---|-------------|--------|-------|
| 1 | "Maintenance" action from All Assets creates a draft for the correct asset (fixes dead `prefillAssetId`) | **PASS** | `prefillAssetId` removed from maintenance workspace; inventory and asset detail call `openMaintenanceForAsset` which hits `POST /asset-maintenances/quick-draft` then navigates with `?maintenanceId=` (`asset-inventory-container.tsx` L465–475, `asset-maintenance-workspace.tsx` L773–779, `routers/__init__.py` L1593–1608). Part 1 dead wiring (`?assetId=` unused) is gone from maintenance flow. |
| 2 | "Start Maintenance" drives real create→submit→approve→start chain | **PASS (code)** / **NOT RUN (runtime)** | `MaintenanceService.start_maintenance` calls existing `update → submit → approve → start` methods (`maintenance_service.py` L390–475). Unit test `test_start_maintenance_chains_submit_approve_start_when_governance_off` asserts `submit`, `approve`, `start` each called once. Governance-on path tested via `test_start_maintenance_surfaces_approval_pending_when_still_submitted`. **Runtime test with live API + both governance modes not executed** (no pytest env in CI shell). |
| 3 | Approval-pending surfaced clearly when governance blocks self-approve | **PASS (code)** | Service raises `MaintenanceApprovalPendingError` (409) when still `submitted` after approve or on SoD (`maintenance_service.py` L449–459). Drawer shows `data-testid="maintenance-approval-pending"` banner (`asset-maintenance-workspace.tsx` L489–496); modal catch also sets `pendingApproval` when message contains "approval" (L269–273). |
| 4 | `reason` and `expected_duration_days` persist; expected return date displays | **PASS** | Migration `0508_ast_maintenance_reason_duration.py` adds columns; model `asset_maintenance.py` L46–47; orchestration writes both on update (`maintenance_service.py` L424–426); table column `expected_return_date` in register (`asset-maintenance-workspace.tsx` L433–434); computed field in schema (`schemas.py` L901–908). |
| 5 | Technician/Vendor are search pickers, not raw UUID inputs | **PASS** | Start modal loads `listEmployeeOptions` / `listVendorOptions` with filterable search + Select (`asset-maintenance-workspace.tsx` L210–211, L682–730). |
| 6 | Assignment and Transfer blocked for any open (pre-Start) maintenance WO | **PASS** | `_validate_no_open_maintenance` uses `find_open_for_asset` in `assignment_validator.py` L419–430 (create + activate paths) and `transfer_validator.py` L198–209 (create + submit/execute). `OPEN_WO_STATUSES` = draft, submitted, approved, scheduled, in_progress (`asset_maintenance_repository.py` L15–21). Unit tests in `test_maintenance_open_wo_blocking.py`. |
| 7 | `IN_USE_AS_COMPONENT` hard-block and assigned-must-return-first unchanged | **PASS** | No edits to `OPS_BLOCKED_FOR_MAINTENANCE_OR_TRANSFER` set or assigned-asset check in `maintenance_validator.py` (`_validate_no_active_assignment` L230–233, `_validate_operational_allows_maintenance` L245–250 still use existing rules including `InUseAsComponent` in ops block set — `operational_status_rules.py` L59–61). |
| 8 | List defaults to open/active WOs; history toggle reveals completed/cancelled | **PASS** | `showHistory` defaults `false`; `open_only: !showHistory` on search (`asset-maintenance-workspace.tsx` L82, L149–153); toggle button L338–346; API `open_only` query on list endpoint (`routers/__init__.py` L1570–1581). |
| 9 | Full-width register + View Detail drawer; no left-form/right-panel split; aggregated timeline | **PASS** | Single table + `maintenance-detail-drawer` (`asset-maintenance-workspace.tsx` L309–581); Start Maintenance is modal (`maintenance-start-modal` L584+), not side panel. Timeline from `GET /{id}/timeline` merges Foundation audit logs + Service History (`maintenance_service.py` L477–531). Pattern mirrors Components drawer (`component-detail-drawer` in `asset-components-workspace.tsx`). |

---

## Backend artifacts

| File | Change |
|------|--------|
| `alembic/versions/0508_ast_maintenance_reason_duration.py` | Add `reason`, `expected_duration_days` |
| `models/asset_maintenance.py` | ORM columns |
| `schemas.py` | Create/update/response + quick-draft, start request, timeline, computed `expected_return_date` |
| `service/maintenance_service.py` | `quick_create_draft`, `start_maintenance`, `get_timeline` |
| `service/maintenance_validator.py` | `validate_start_maintenance_fields` |
| `service/assignment_validator.py` | Open WO blocking |
| `service/transfer_validator.py` | Open WO blocking |
| `domain/exceptions.py` | `MaintenanceApprovalPendingError` (409) |
| `repository/asset_maintenance_repository.py` | `open_only` filter |
| `routers/__init__.py` | `open_only`, `/quick-draft`, `/timeline`, `/start-maintenance` |
| `foundation/repository/audit_repository.py` | `list_logs_for_entity` (timeline) |

## Frontend artifacts

| File | Change |
|------|--------|
| `asset-maintenance-workspace.tsx` | Full rewrite: register, drawer, Start modal, `openMaintenanceForAsset` |
| `asset-inventory-container.tsx` | Maintenance menu → quick-draft + navigate |
| `asset-detail-workspace.tsx` | Maintenance button → quick-draft |
| `services/assets-service.ts` | `maintenanceService` (search, quickDraft, startMaintenance, timeline, complete) |

## Tests

| File | Status |
|------|--------|
| `test_maintenance_open_wo_blocking.py` | Written — **not executed** (no project venv/pytest in agent shell) |
| `test_maintenance_start_orchestration.py` | Written + iterator bug fixed — **not executed** |

## Known gaps / follow-ups

1. **`asset-navigation.ts`** still defines `maintenance(assetId) → ?assetId=` for `openMaintenance`, but inventory/detail bypass this and use `openMaintenanceForAsset`. Any other caller of `navigation.openMaintenance` would still hit the old dead param (low risk; inventory handles maintenance before `dispatchInventoryMenuAction`).
2. **`start-maintenance` approval-pending** is surfaced via HTTP 409 exception, not a 200 with `status: "approval_pending"` — FE handles both paths but the success-path branch (`result.status === "approval_pending"`) is effectively unused when governance blocks.
3. **Migration `0508`** must be applied before runtime verification (`alembic upgrade head`).
4. **End-to-end governance on/off** should be smoke-tested manually after migration.

## Summary

All Part 2 requirements are implemented in code with unit tests authored. Automated pytest execution and live governance smoke tests were **not run** in this session; checklist items 2 and tests are marked accordingly. Apply migration `0508` and run:

```bash
cd apps/api
PYTHONPATH=src pytest src/tests/unit/asset/test_maintenance_open_wo_blocking.py \
  src/tests/unit/asset/test_maintenance_start_orchestration.py -q
```
