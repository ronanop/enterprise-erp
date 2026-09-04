# CR-003 — Asset Discovery Module

**Status:** Implemented  
**Module:** Asset Management  
**Date:** 2026-07-31  
**Baseline:** Post FP-ASSET-019 + CR-001 + CR-002

---

## Business Requirement

Employees generate a platform discovery command, paste device output into the Asset Information Portal, parse/normalize for preview, then apply allowlisted hardware identity fields to the asset.

---

## Architecture

```text
Discovery UI (Information Portal)
  → DiscoveryController (routes)
  → AssetDiscoveryService
      → HardwareInventoryParser (pure, no DB)
      → DiscoveryValidator
      → AssetService.apply_discovery_profile()
          → AssetRepository
          → AuditService
```

Parser never accesses repositories.

---

## Discovery Workflow

1. Select platform (Windows / Linux / macOS)
2. Copy generated command
3. Run on device; paste output
4. **Parse** → preview profile + change list (`persisted=false`)
5. **Apply** requires `preview_confirmed=true` → re-parse → persist via AssetService

---

## Parser Design

- Version `1.0.0`
- Prefer `KEY=VALUE` lines from generated scripts
- Fallback `Key: Value` patterns
- Normalizes MAC to `AA:BB:CC:DD:EE:FF`
- Profile sections: device, os, hardware, storage, network, metadata

---

## Validation Rules

- Raw output max 256KB
- Apply only when asset status ∈ draft|approved|active|in_maintenance|transferred
- Allowlisted ORM fields: `discovery_profile_json`, `serial_number` (+ version)
- Forbidden: cost, category, assignment, department, location, workflow, finance, status
- Serial uniqueness enforced company-wide

---

## API Changes

| Method | Path | Permission |
|--------|------|------------|
| GET | `/assets/assets/discovery/command?platform=` | `asset.asset:read` |
| POST | `/assets/assets/{id}/discovery/parse` | `asset.asset:read` |
| POST | `/assets/assets/{id}/discovery/apply` | `asset.asset:update` |

Existing registration/workflow APIs unchanged.

---

## Database Impact

Migration `0485_ast_discovery_profile`:

- Add nullable `asset.ast_asset.discovery_profile_json` (JSONB)
- No column explosion

---

## Security

- Authenticated only
- Apply requires `asset.asset:update`
- Audit operation `discovery_apply`
- Optimistic locking via `version`

---

## Frontend

Discovery section embedded in Asset Information Portal:

- Platform selector, Copy Command, Paste, Parse, Preview table, Apply
- Apply disabled until preview exists

---

## Testing

- `test_discovery_parser.py`
- `test_discovery_service.py`
- `test_discovery_apply_service.py`
- Regression: portal, category, registration validators

---

## Rollback

1. Feature-flag or remove discovery routes/UI
2. Alembic downgrade drops `discovery_profile_json`
3. No workflow rollback needed

---

## Final Result

CR-003 delivers an Asset Discovery module with preview-before-apply, JSON profile persistence, and strict allowlisting through AssetService.
