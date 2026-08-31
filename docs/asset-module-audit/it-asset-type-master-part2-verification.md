# IT Assets — Asset Type Master Part 2 (Verification Checklist)

**Date:** 2026-08-31  
**Migration:** `0506_ast_asset_type` (down from `0505_ast_location_master`)

## Decision 4 — legacy `ast_asset.asset_type` enum column

**Kept (not dropped).** Justification:

| Remaining reader | Still depends on enum? |
|---|---|
| `ck_ast_asset_type` + NOT NULL column | Schema still requires a value |
| `RegistrationValidator.ASSET_TYPES` / submit readiness | Still validates/requires string |
| `AssetResponse.asset_type` / detail & portal display of raw enum | Still serialized |
| Incoming registration / many integration fixtures | Still write `asset_type="fixed"` |
| Excel defaults `asset_type: "fixed"` | Silent legacy fill only |

**New source of truth:** `ast_asset.asset_type_id` → `ast_asset_type`.  
On create/import the server sets `asset_type = "fixed"` when omitted — **not** dual-written from type name. Flag for a later cleanup phase: drop or nullable the enum once remaining readers are migrated.

## Checklist

| # | Item | Result | Proof |
|---|---|---|---|
| 1 | Migration additive except justified enum decision | **PASS** | Adds `asset.ast_asset_type`, nullable `ast_asset.asset_type_id` FK/index, permissions `asset.type:*`. Enum column retained (see above). Does not alter `ast_asset_category`. |
| 2 | Seeded exactly 7 types, no Furniture/Vehicle | **PASS** | After `alembic upgrade head`: `Desktop, Keyboard, Laptop, Mobile Device, Monitor, Mouse, Other` with HW flags `T/F/T/T/F/F/F`. |
| 3 | `requires_hardware_config` drives Add Asset hardware UI | **PASS** | `asset-add-form.tsx` uses selected type flag; `asset-it-config-rules.ts` deleted; options live in `asset-hardware-options.ts`. Vitest add-form suite included in 121 passing FE tests. |
| 4 | Deactivate in-use type blocked | **PASS** | `AssetTypeService._assert_can_deactivate` → `Cannot deactivate type while {n} asset(s) reference it` (same style as Category deactivate guard). |
| 5 | Historical assets `asset_type_id` NULL / Unclassified | **PASS** | FK nullable; no backfill in migration; detail UI shows `asset_type_name` or **"Unclassified"**. |
| 6 | Inventory Type filter uses type master | **PASS** | `inventory.mapper.ts` sends `asset_type_id`; filter options from `listItAssetTypes`; default options no longer Fixed/Digital/Leased. |
| 7 | Excel: Type fail-fast; Category UI removed; category still silent | **PASS** | `EXCEL_IMPORT_TARGET_FIELDS` has required Type; Category column removed; validator `invalid_type`; API row requires `asset_type_id`; container still supplies `defaults.asset_category_id`. |
| 8 | `/assets/asset-types` full CRUD, admin-gated | **PASS** | `AssetTypesWorkspace` create/edit/deactivate/reactivate; write via IT domain admin / module admin / `asset.type:*` (same site-access pattern as Locations). |
| 9 | Category not visible in IT UI; backend Category untouched this phase | **PASS (UI)** / **PASS (BE scope)** | Config nav has Asset Types only (no Categories). Add Asset / inventory filter / Excel mapping have no Category control. **Proof Category backend not part of this phase:** `git diff` empty for `category_validator.py`, `asset_category_engine.py`, `asset_report_service.py`, `asset_report_repository.py`; permissions diff adds `asset.type:*` only (no `asset.category:*` edits). Note: working tree may still show earlier Non-IT `asset_domain` on category model from prior work — not introduced by Type Master. |
| 10 | Old catalog files deleted; no dangling imports; tests updated | **PASS** | `asset-prd-types.ts` / `asset-it-config-rules.ts` gone; ripgrep finds no `ASSET_PRD_TYPES` / `getItConfigRule`. FE vitest: **121 passed** (add-form, inventory mapper, excel-import, api-mapper, shared). |

## Flags (do not silently paper over)

1. **Legacy enum column** still required/defaulted — retire in a dedicated follow-up once response shapes and validators stop needing it.
2. **Incoming registration** still prefills enum `asset_type`; Add Asset maps by type **name** only if enum string happens to match a type name (usually won't) — otherwise user must pick a type. Prefer adding optional `asset_type_id` to incoming prefill later.
3. **Submit readiness** now requires `asset_type_id` — any pre-existing **draft** assets without a type cannot submit until classified (historical approved assets unaffected).
4. **Excel import page** still accepts unused `categories` / `defaultCategoryId` props for silent defaults — no UI control; optional cleanup.
5. **API pytest** not runnable in this environment (venv lacks `pytest`); FE coverage executed instead. Recommend CI for backend registration/excel unit tests after adding `asset_type_id` to fixtures that call `create`/`validate_create_fields`.

## Out of scope (confirmed untouched)

- Non-IT module  
- Per-type code prefixes (still global `AST-`)  
- Historical type backfill  
- Removal of `ast_asset_category` table/FK/validators/reports/permissions  
