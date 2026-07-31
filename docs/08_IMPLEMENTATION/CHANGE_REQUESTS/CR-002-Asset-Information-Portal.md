# CR-002 — Asset Information Portal + QR Self-Service

**Status:** Implemented  
**Module:** Asset Management  
**Date:** 2026-07-31  
**Baseline:** Post FP-ASSET-019 + CR-001

---

## Business Requirement

Provide a centralized **Asset Information Portal** (read-only) opened from the asset register **View** action. Include overview, assignment, warranty, insurance, and dynamically generated QR for authenticated self-service. Never store QR images. No public/unauthenticated access.

---

## Previous State

- Registration workspace listed assets with workflow actions only.
- `ast_asset.qr_code` column existed but unused for image storage (and remains unused).
- No dedicated portal or self-service UI.

---

## Architecture

```text
UI View → /assets/information-portal/{id}
  → GET /api/v1/assets/assets/{id}/information-portal
      → AssetInformationPortalService
          → AssetService.get (mandatory)
          → category / assignment / warranty / insurance reads
          → master vendor/product/employee (safe)
  → QRCodeCanvas encodes {origin}/assets/self-service/{id} (client-only)

Self-service page → GET .../self-service (same redacted DTO)
```

Clean Architecture preserved. No workflow/engine changes.

---

## QR Flow

1. Browser builds absolute URL from `window.location.origin`.
2. `qrcode.react` renders canvas in memory.
3. Download/Print operate on canvas data URL locally.
4. Server never receives PNG/SVG/Base64.

Payload: `/assets/self-service/{assetId}` (absolute with origin).

---

## Security Model

- Both portal and self-service require authenticated session + `asset.asset:read`.
- Response DTO omits purchase cost, book value, depreciation, workflow, finance IDs.
- Signed-token public access deferred; `get_self_service` alias reserved for future without UI change.

---

## Backend Changes

- `schemas.py` — `AssetInformationPortalResponse` (+ assignment/warranty/insurance summaries)
- `information_portal_service.py` — composition service
- Router additive:
  - `GET /assets/assets/{id}/information-portal`
  - `GET /assets/assets/{id}/self-service`

Manufacturer ← supplier vendor name; Model ← linked product name (no new columns).

---

## Frontend Changes

- Registration table **View** → `/assets/information-portal/{id}`
- `asset-information-portal.tsx` — portal sections + QR download/print/open
- `asset-self-service-view.tsx` — redacted self-service page
- Routes under `(app)/assets/...` (auth shell)
- `assets-service.ts` — portal client + `buildSelfServiceUrl`
- Dependency: `qrcode.react`

---

## API Changes

| Method | Path | Permission |
|--------|------|------------|
| GET | `/api/v1/assets/assets/{id}/information-portal` | `asset.asset:read` |
| GET | `/api/v1/assets/assets/{id}/self-service` | `asset.asset:read` |

Existing asset CRUD/workflow APIs unchanged.

---

## Database Impact

**None.** No migrations. No QR storage.

---

## Testing

- `test_information_portal_service.py` — AssetService usage, redaction, aliases
- `asset-self-service-url.test.mjs` — URL builder
- Regression: category + registration unit suites remain green

---

## Rollback

1. Remove portal/self-service routes and FE pages.
2. Remove View link from registration table.
3. Uninstall `qrcode.react` if desired.
4. No DB rollback.

---

## Final Result

CR-002 delivers an authenticated Asset Information Portal with dynamic QR self-service, without architectural drift, workflow changes, or database mutations.
