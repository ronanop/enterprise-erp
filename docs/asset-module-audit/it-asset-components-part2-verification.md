# IT Assets — Components Part 2 Verification

**Date:** 2026-08-31  
**Scope:** Silent codes, UI redesign, asset-as-component link, `IN_USE_AS_COMPONENT`, return auto-detach, ops-only cascade dispose.

## Pass / fail checklist

| # | Criterion | Result | Proof |
|---|---|---|---|
| 1 | Code/Name removed from Install form + register table; codes silently generated | **PASS** | `asset-components-workspace.tsx` install dialog has no code/name inputs; table columns are Identity / Type / Parent / Status / Qty / Actions. Server: `ComponentCodeService.next_code` (`{TYPE}-NNNN` with parent `FOR UPDATE`) + name default from type label or linked asset name in `component_service.install`. |
| 2 | Full-width table + View Detail; no left/right split | **PASS** | Workspace uses `AssetsPremiumPage` + single register `Card`; detail is Inventory-style right drawer (`component-detail-drawer`) with Detail / Hierarchy / Code history. |
| 3 | `eligible_as_component` on type master; Laptop=false; picker uses flag | **PASS** | Migration `0507_ast_component_asset_link.py` adds column + `UPDATE … WHERE lower(name)='laptop'`. Model/service/router/FE Types admin checkbox. Attach picker: `list_attachable_assets` filters `eligible_as_component` — no `"Laptop"` string in Components code. |
| 4 | Attach: READY + eligible + not parent; DB partial unique | **PASS** | Validator + `list_attachable_assets`. Index `uq_ast_asset_component_one_active_child_asset` WHERE `status='active' AND is_deleted=false AND component_asset_id IS NOT NULL`. |
| 5 | `IN_USE_AS_COMPONENT` fully wired | **PASS** | Enum, DB check, transition matrix (+3 edges), actions `attach_as_component` / `detach_as_component` / `complete_disposal` from InUse. FE: `asset-status.ts`, `inventory.types.ts` preset, badge, Excel `VALID_OPERATIONAL_STATUSES`, dashboard summary + KPI + nav, assignment messages, transfer block set. Tests updated for 6 values / 10 transitions. |
| 6 | InUse cannot assign / transfer / receive components | **PASS** | Assignment still READY-only + message for InUse. `OPS_BLOCKED_FOR_MAINTENANCE_OR_TRANSFER` includes InUse. Install rejects parent ops InUse; attach rejects child hosting linked actives. |
| 7 | Attach from Components Install + Assignment Issued Items | **PASS** | Install dialog mode “Attach asset”; Issued Items “Attach asset as component” → `componentService.install({ component_asset_id })` then refresh/select. |
| 8 | Parent return (any return_condition) detaches linked → READY | **PASS** | `AssignmentService.return_assignment` calls `detach_linked_for_parent` after reconcile, before parent ops apply. Detach: row → `replaced`; child `detach_as_component` → READY (never inherits outdated/dead). |
| 9 | Component dispose on asset-linked → child DISPOSED ops-only | **PASS** | `dispose` calls `apply_action(..., complete_disposal)` on child — **no** `DisposalService` draft/submit/post / finance journal. Deliberate shortcut per locked decision. |
| 10 | Parent disposal still blocked while any active components | **PASS** | Unchanged `_assert_no_active_components` (lists active rows regardless of `component_asset_id`). |
| 11 | Detail views prefer linked asset identity | **PASS** | Register identity column, detail drawer, accessories card, inventory enrichment, issued-items / return labels use `linked_asset_*`. |

## Detach decision (locked in code)

On parent return, asset-linked component rows are set to status **`replaced`** (not soft-deleted). This preserves `(asset_id, component_code)` history lineage and clears the active partial-unique slot without orphaned active rows.

## Cascade dispose note

Child asset ops → `DISPOSED` via `complete_disposal` only. **No finance journal / disposal workflow document** is created for this path — intentional.

## Conflicts flagged (reviewed & addressed)

| Issue | Resolution |
|---|---|
| Dashboard summary buckets were a closed five-status map — sixth status would be dropped from KPIs | Extended `_OPS_STATUS_TO_COUNT_ATTR`, schemas, FE mapper, ops dashboard KPI + inventory preset `in_use_as_component` |
| Transfer message still said only retired/pending/disposed | Updated copy to include in-use-as-component |

## Migration

Apply: `0507_ast_component_asset_link` (down_revision `0506_ast_asset_type`).

## Out of scope (confirmed untouched)

Asset Type Master CRUD beyond `eligible_as_component`; Location Master; Non-IT; full financial disposal for cascade children.
