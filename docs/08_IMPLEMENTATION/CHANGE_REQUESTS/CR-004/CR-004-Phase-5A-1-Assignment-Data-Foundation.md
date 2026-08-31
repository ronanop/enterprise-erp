# CR-004 Phase 5A-1 — Assignment Data Foundation

**Scope:** Data layer only (Excel migration preparation). No service, workflow, validator, or router changes.

## Columns (`asset.ast_asset_assignment`)

| Column | Type | Notes |
|--------|------|--------|
| `delivery_reference_number` | `varchar(100)` nullable | Challan / DC / external ref |
| `delivery_reference_status` | `varchar(30)` NOT NULL, default `not_applicable` | CHECK: `not_applicable`, `pending`, `issued`, `received` |
| `assignment_remarks` | `text` nullable | Issue / assignment notes |
| `return_remarks` | `text` nullable | Return notes |

## Migration

- `0487_ast_assignment_data_foundation` (revises `0486_ast_operational_status`)
- Drops legacy draft columns if present: `delivery_challan_*`, `remarks`, `return_condition`

## API schemas

`AssetAssignmentCreate`, `AssetAssignmentUpdate`, and `AssetAssignmentResponse` expose the four fields. Create/update service paths do not populate them until a later phase.

## Tests

- `apps/api/src/tests/unit/asset/test_assignment_data_foundation.py` — migration metadata, ORM, schemas, repository, OpenAPI response surface (40+ cases).

## Next phase (out of scope for 5A-1)

- Service create/update/return persistence
- Validators and issuance rules
- Workflow / router body changes
- Excel import mapping
